import { Router } from "express";
import { z } from "zod";
import { Role, Sexe, Cycle } from "../types/enums";
import { prisma } from "../lib/prisma";
import { authentifier, autoriserRoles } from "../middleware/auth.middleware";
import { hacherMotDePasse } from "../utils/password";
import { analyserTextePdfEleves } from "../services/importPdf.service";
import { extraireTexteAvecMiseEnPage } from "../services/pdfExtraction.service";
import { analyserDocumentAvecIA, iaPdfDisponible } from "../services/pdfIA.service";
import * as XLSX from "xlsx";
import * as mammoth from "mammoth";

export const elevesRouter = Router();
elevesRouter.use(authentifier);

async function extraireTexteDocument(tampon: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "application/pdf") return extraireTexteAvecMiseEnPage(tampon);
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") {
    const classeur = XLSX.read(tampon, { type: "buffer", cellDates: true });
    return classeur.SheetNames.map((nom) => `FEUILLE: ${nom}\n${XLSX.utils.sheet_to_csv(classeur.Sheets[nom])}`).join("\n\n");
  }
  if (mimeType.includes("word") || mimeType.includes("officedocument.wordprocessingml")) {
    const extrait = await mammoth.extractRawText({ buffer: tampon });
    return extrait.value;
  }
  if (mimeType.startsWith("text/")) return tampon.toString("utf8");
  return "";
}

const schemaInscriptionEleve = z.object({
  nom: z.string().min(1, "Le nom est requis."),
  prenom: z.string().min(1, "Le prénom est requis."),
  dateNaissance: z.string().refine((d) => !isNaN(Date.parse(d)), "Date de naissance invalide."),
  sexe: z.nativeEnum(Sexe),
  matricule: z.string().trim().max(80).optional(),
  classeId: z.string().uuid().optional(),
  // Compte de consultation optionnel créé pour l'élève lui-même
  creerCompteEleve: z.boolean().optional(),
  emailEleve: z.string().email().optional(),
  motDePasseEleve: z.string().min(8).optional(),
});

/**
 * POST /api/eleves/inscription
 * Prend en charge l'élève dès le jour de son inscription : crée sa fiche,
 * conserve le matricule fourni, ou le laisse vide si l’établissement n’en utilise pas.
 * Réservé à l'administration.
 */
elevesRouter.post("/inscription", autoriserRoles(Role.ADMIN), async (req, res) => {
  const resultat = schemaInscriptionEleve.safeParse(req.body);
  if (!resultat.success) {
    return res.status(400).json({ erreur: resultat.error.errors[0].message });
  }
  const donnees = resultat.data;

  if (donnees.classeId) {
    const classe = await prisma.classe.findFirst({
      where: { id: donnees.classeId, ecoleId: req.utilisateur!.ecoleId },
    });
    if (!classe) {
      return res.status(404).json({ erreur: "Classe introuvable." });
    }
  }

  let compteUtilisateurId: string | undefined;
  if (donnees.creerCompteEleve) {
    if (!donnees.emailEleve || !donnees.motDePasseEleve) {
      return res.status(400).json({
        erreur: "Email et mot de passe requis pour créer le compte de consultation de l'élève.",
      });
    }
    const motDePasseHache = await hacherMotDePasse(donnees.motDePasseEleve);
    const compte = await prisma.utilisateur.create({
      data: {
        nom: donnees.nom,
        prenom: donnees.prenom,
        email: donnees.emailEleve,
        motDePasse: motDePasseHache,
        role: Role.ELEVE,
        ecoleId: req.utilisateur!.ecoleId,
      },
    });
    compteUtilisateurId = compte.id;
  }

  const eleve = await prisma.eleve.create({
    data: {
      matricule: donnees.matricule?.trim() || null,
      nom: donnees.nom,
      prenom: donnees.prenom,
      dateNaissance: new Date(donnees.dateNaissance),
      sexe: donnees.sexe,
      classeId: donnees.classeId,
      ecoleId: req.utilisateur!.ecoleId,
      compteUtilisateurId,
    },
  });

  return res.status(201).json(eleve);
});

/**
 * POST /api/eleves/importer/analyser
 * Reçoit un PDF (encodé en base64) fourni par l'administration — une liste
 * d'élèves déjà en sa possession — et tente d'en extraire automatiquement
 * les noms, prénoms et classes. Le résultat est une simple proposition à
 * relire et corriger côté interface avant tout enregistrement réel : cette
 * route ne crée aucun élève.
 */
const schemaAnalyseDocument = z.object({
  documentBase64: z.string().min(1).optional(),
  pdfBase64: z.string().min(1).optional(),
  mimeType: z.string().optional(),
  nomFichier: z.string().optional(),
}).refine((donnees) => Boolean(donnees.documentBase64 || donnees.pdfBase64), "Aucun fichier reçu.");

elevesRouter.post("/importer/analyser", autoriserRoles(Role.ADMIN), async (req, res) => {
  const resultat = schemaAnalyseDocument.safeParse(req.body);
  if (!resultat.success) {
    return res.status(400).json({ erreur: resultat.error.errors[0].message });
  }

  let tampon: Buffer;
  try {
    const base64 = resultat.data.documentBase64 ?? resultat.data.pdfBase64!;
    tampon = Buffer.from(base64, "base64");
  } catch {
    return res.status(400).json({ erreur: "Fichier PDF invalide." });
  }

  const base64 = resultat.data.documentBase64 ?? resultat.data.pdfBase64!;
  const mimeType = resultat.data.mimeType ?? "application/pdf";
  const nomFichier = resultat.data.nomFichier ?? "document";
  let texte = "";
  try {
    // Première passe locale : elle est rapide, gratuite et respecte les colonnes.
    texte = await extraireTexteDocument(tampon, mimeType);
  } catch {
    // Un PDF scanné peut ne contenir aucun flux texte. L’analyse IA peut
    // néanmoins le lire directement si elle est configurée côté serveur.
  }

  const classesExistantes = await prisma.classe.findMany({
    where: { ecoleId: req.utilisateur!.ecoleId },
    select: { id: true, nom: true },
  });

  let lignes = texte ? analyserTextePdfEleves(texte, classesExistantes) : [];
  let modeLecture = "lecture locale";

  // Seconde passe : l’IA reçoit le PDF lui-même et peut donc lire les scans,
  // les tableaux complexes et les colonnes mal encodées par le générateur PDF.
  // Si le service distant échoue, la première passe locale reste disponible.
  if (iaPdfDisponible() && process.env.PDF_IMPORT_USE_IA !== "false") {
    try {
      const lignesIA = await analyserDocumentAvecIA(base64, mimeType, nomFichier, texte);
      if (lignesIA.length > 0) { lignes = lignesIA; modeLecture = "Relo IA haute précision"; }
    } catch {
      if (lignes.length > 0) modeLecture = "lecture locale — IA indisponible";
    }
  }

  // Rattacher les lignes aux classes déjà créées dès que le nom est proche.
  lignes = lignes.map((ligne) => {
    if (!ligne.classeTexte || ligne.classeId) return ligne;
    const classe = classesExistantes.slice().sort((a, b) => b.nom.length - a.nom.length).find((c) => {
      const a = ligne.classeTexte!.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const b = c.nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      return a.includes(b) || b.includes(a);
    });
    return classe ? { ...ligne, classeId: classe.id, classeTexte: classe.nom } : ligne;
  });

  if (lignes.length === 0) {
    return res.status(422).json({
      erreur: "Aucun élève n'a pu être détecté. Essayez un document plus net ou activez OPENAI_API_KEY pour activer la lecture avancée des scans et des images.",
    });
  }

  const nomsExistants = new Set(classesExistantes.map((c) => c.nom.toLowerCase()));
  const classesSuggerees = [...new Map(lignes.filter((l) => l.classeTexte && !l.classeId).map((l) => [l.classeTexte!.toLowerCase(), l.classeTexte!])).values()]
    .filter((nom) => !nomsExistants.has(nom.toLowerCase()))
    .map((nom) => ({ nom, cycle: /^(1|2|3|4|5|6)\s?(?:ere|ère|eme|ème)/i.test(nom) ? Cycle.PRIMAIRE : /^(7|8|9)\s?(?:eme|ème)/i.test(nom) ? Cycle.COLLEGE : Cycle.LYCEE }));

  return res.json({ lignes, classesSuggerees, modeLecture });
});

/**
 * POST /api/eleves/importer
 * Enregistre en une fois une liste d'élèves — typiquement celle obtenue
 * (puis relue et corrigée par l'administration) depuis /importer/analyser.
 * Chaque ligne est validée et traitée indépendamment : une erreur sur une
 * ligne n'empêche pas l'import des autres.
 */
const schemaLigneImport = z.object({
  nom: z.string().min(1),
  prenom: z.string().min(1),
  dateNaissance: z.string().refine((d) => !isNaN(Date.parse(d)), "Date de naissance invalide."),
  sexe: z.nativeEnum(Sexe),
  matricule: z.string().trim().max(80).optional(),
  classeId: z.string().uuid().optional(),
});

const schemaImportMasse = z.object({
  eleves: z.array(schemaLigneImport).min(1, "Aucun élève à importer."),
});

elevesRouter.post("/importer", autoriserRoles(Role.ADMIN), async (req, res) => {
  const resultat = schemaImportMasse.safeParse(req.body);
  if (!resultat.success) {
    return res.status(400).json({ erreur: resultat.error.errors[0].message });
  }

  const idsClasses = [...new Set(resultat.data.eleves.map((e) => e.classeId).filter(Boolean))] as string[];
  const classesValides = idsClasses.length
    ? await prisma.classe.findMany({ where: { id: { in: idsClasses }, ecoleId: req.utilisateur!.ecoleId } })
    : [];
  const idsClassesValides = new Set(classesValides.map((c) => c.id));

  const crees: { nom: string; prenom: string; matricule: string | null }[] = [];
  const echecs: { ligne: number; nom: string; prenom: string; motif: string }[] = [];

  for (let i = 0; i < resultat.data.eleves.length; i++) {
    const donnees = resultat.data.eleves[i];
    if (donnees.classeId && !idsClassesValides.has(donnees.classeId)) {
      echecs.push({ ligne: i + 1, nom: donnees.nom, prenom: donnees.prenom, motif: "Classe introuvable." });
      continue;
    }
    try {
      const eleve = await prisma.eleve.create({
        data: {
          matricule: donnees.matricule?.trim() || null,
          nom: donnees.nom,
          prenom: donnees.prenom,
          dateNaissance: new Date(donnees.dateNaissance),
          sexe: donnees.sexe,
          classeId: donnees.classeId,
          ecoleId: req.utilisateur!.ecoleId,
        },
      });
      crees.push({ nom: eleve.nom, prenom: eleve.prenom, matricule: eleve.matricule });
    } catch {
      echecs.push({ ligne: i + 1, nom: donnees.nom, prenom: donnees.prenom, motif: "Erreur lors de l'enregistrement." });
    }
  }

  return res.status(207).json({ crees, echecs });
});

/**
 * GET /api/eleves/moi
 * Un élève retrouve son propre dossier à partir de son compte connecté.
 * Utilisé par le portail de consultation.
 */
elevesRouter.get("/moi", autoriserRoles(Role.ELEVE), async (req, res) => {
  const eleve = await prisma.eleve.findFirst({
    where: { compteUtilisateurId: req.utilisateur!.userId, ecoleId: req.utilisateur!.ecoleId },
    include: { classe: true },
  });

  if (!eleve) {
    return res.status(404).json({ erreur: "Aucun dossier élève lié à ce compte." });
  }

  return res.json(eleve);
});

/**
 * GET /api/eleves/mes-enfants
 * Un parent liste tous les élèves qui lui sont liés.
 * Utilisé par le portail de consultation.
 */
elevesRouter.get("/mes-enfants", autoriserRoles(Role.PARENT), async (req, res) => {
  const liens = await prisma.lienParentEleve.findMany({
    where: { parentId: req.utilisateur!.userId },
    include: { eleve: { include: { classe: true } } },
  });

  return res.json(liens.map((l) => l.eleve));
});

// GET /api/eleves?classeId=... — liste des élèves (admin et professeur)
elevesRouter.get("/", autoriserRoles(Role.ADMIN, Role.PROFESSEUR), async (req, res) => {
  const { classeId } = req.query;

  const eleves = await prisma.eleve.findMany({
    where: {
      ecoleId: req.utilisateur!.ecoleId,
      ...(classeId ? { classeId: String(classeId) } : {}),
    },
    include: { classe: true },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });

  return res.json(eleves);
});

const schemaModificationEleve = z.object({
  nom: z.string().trim().min(1).max(100).optional(),
  prenom: z.string().trim().min(1).max(100).optional(),
  dateNaissance: z.string().refine((d) => !isNaN(Date.parse(d)), "Date de naissance invalide.").optional(),
  sexe: z.nativeEnum(Sexe).optional(),
  matricule: z.string().trim().max(80).nullable().optional(),
  classeId: z.string().uuid().nullable().optional(),
  statut: z.string().trim().min(1).max(30).optional(),
});

// PATCH /api/eleves/:id — une seule voie de modification directe depuis Relo.
elevesRouter.patch("/:id", autoriserRoles(Role.ADMIN), async (req, res) => {
  const resultat = schemaModificationEleve.safeParse(req.body);
  if (!resultat.success) return res.status(400).json({ erreur: resultat.error.errors[0].message });
  const eleve = await prisma.eleve.findFirst({ where: { id: req.params.id, ecoleId: req.utilisateur!.ecoleId } });
  if (!eleve) return res.status(404).json({ erreur: "Élève introuvable." });
  if (resultat.data.classeId && !(await prisma.classe.findFirst({ where: { id: resultat.data.classeId, ecoleId: req.utilisateur!.ecoleId } }))) return res.status(404).json({ erreur: "Classe introuvable." });
  const matriculeNormalise = resultat.data.matricule?.trim() || null;
  if (matriculeNormalise) {
    const doublon = await prisma.eleve.findFirst({ where: { matricule: matriculeNormalise, NOT: { id: eleve.id } } });
    if (doublon) return res.status(409).json({ erreur: "Ce matricule est déjà utilisé par un autre élève." });
  }
  try {
    const { dateNaissance, matricule, ...champs } = resultat.data;
    const modifie = await prisma.eleve.update({ where: { id: eleve.id }, data: { ...champs, ...(dateNaissance ? { dateNaissance: new Date(dateNaissance) } : {}), ...(matricule !== undefined ? { matricule: matricule?.trim() || null } : {}) } });
    return res.json(modifie);
  } catch { return res.status(409).json({ erreur: "Impossible de modifier cette fiche élève." }); }
});

/**
 * GET /api/eleves/:id
 * Accessible à l'admin, au professeur, et au parent/élève concerné uniquement
 * (contrôle d'accès appliqué ci-dessous, pas seulement via le rôle).
 */
elevesRouter.get("/:id", async (req, res) => {
  const eleve = await prisma.eleve.findFirst({
    where: { id: req.params.id, ecoleId: req.utilisateur!.ecoleId },
    include: { classe: true },
  });

  if (!eleve) {
    return res.status(404).json({ erreur: "Élève introuvable." });
  }

  const { role, userId } = req.utilisateur!;

  if (role === Role.ADMIN || role === Role.PROFESSEUR) {
    return res.json(eleve);
  }

  if (role === Role.ELEVE) {
    if (eleve.compteUtilisateurId !== userId) {
      return res.status(403).json({ erreur: "Accès refusé à ce dossier." });
    }
    return res.json(eleve);
  }

  if (role === Role.PARENT) {
    const lien = await prisma.lienParentEleve.findFirst({
      where: { parentId: userId, eleveId: eleve.id },
    });
    if (!lien) {
      return res.status(403).json({ erreur: "Accès refusé à ce dossier." });
    }
    return res.json(eleve);
  }

  return res.status(403).json({ erreur: "Accès refusé." });
});

// POST /api/eleves/:id/parents — lier un parent à un élève (admin uniquement)
const schemaLienParent = z.object({ parentUtilisateurId: z.string().uuid() });

elevesRouter.post("/:id/parents", autoriserRoles(Role.ADMIN), async (req, res) => {
  const resultat = schemaLienParent.safeParse(req.body);
  if (!resultat.success) {
    return res.status(400).json({ erreur: resultat.error.errors[0].message });
  }

  const eleve = await prisma.eleve.findFirst({
    where: { id: req.params.id, ecoleId: req.utilisateur!.ecoleId },
  });
  if (!eleve) {
    return res.status(404).json({ erreur: "Élève introuvable." });
  }

  const parent = await prisma.utilisateur.findFirst({ where: { id: resultat.data.parentUtilisateurId, ecoleId: req.utilisateur!.ecoleId, role: Role.PARENT } });
  if (!parent) return res.status(404).json({ erreur: "Compte parent introuvable." });
  const lien = await prisma.lienParentEleve.create({ data: { parentId: parent.id, eleveId: eleve.id } });

  return res.status(201).json(lien);
});

elevesRouter.delete("/:id",autoriserRoles(Role.ADMIN),async(req,res)=>{const e=await prisma.eleve.findFirst({where:{id:req.params.id,ecoleId:req.utilisateur!.ecoleId}});if(!e)return res.status(404).json({erreur:"Élève introuvable."});await prisma.eleve.update({where:{id:e.id},data:{statut:"TRANSFERE",classeId:null}});if(e.compteUtilisateurId)await prisma.utilisateur.update({where:{id:e.compteUtilisateurId},data:{actif:false}});res.status(204).send()});
