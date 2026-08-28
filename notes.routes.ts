import { Router } from "express";
import { z } from "zod";
import { Role, TypeEvaluation, Trimestre } from "../types/enums";
import { prisma } from "../lib/prisma";
import { authentifier, autoriserRoles } from "../middleware/auth.middleware";
import { calculerMoyenneEleve, calculerClassement } from "../services/calcul.service";

export const notesRouter = Router(); notesRouter.use(authentifier);
const schemaNote = z.object({ eleveId: z.string().uuid(), classeMatiereId: z.string().uuid(), valeur: z.number().min(0), bareme: z.number().positive().default(20), type: z.nativeEnum(TypeEvaluation), trimestre: z.nativeEnum(Trimestre) });
const schemaModif = z.object({ valeur: z.number().min(0), bareme: z.number().positive().optional() });

async function affectationOK(professeurId: string, classeMatiereId: string) {
  return !!(await prisma.affectationProf.findFirst({ where: { professeurId, classeMatiereId } }));
}
async function publication(classeId: string, trimestre: Trimestre) {
  return prisma.publication.findUnique({ where: { classeId_trimestre: { classeId, trimestre } } });
}

notesRouter.post("/", autoriserRoles(Role.ADMIN, Role.PROFESSEUR), async (req, res) => {
  const r = schemaNote.safeParse(req.body); if (!r.success) return res.status(400).json({ erreur: r.error.errors[0].message });
  const d = r.data; const u = req.utilisateur!;
  const [eleve, cm] = await Promise.all([
    prisma.eleve.findFirst({ where: { id: d.eleveId, ecoleId: u.ecoleId } }),
    prisma.classeMatiere.findFirst({ where: { id: d.classeMatiereId, classe: { ecoleId: u.ecoleId } }, include: { classe: true } }),
  ]);
  if (!eleve || !cm || eleve.classeId !== cm.classeId) return res.status(404).json({ erreur: "Élève ou matière introuvable dans cette classe." });
  if (u.role === Role.PROFESSEUR && !(await affectationOK(u.userId, d.classeMatiereId))) return res.status(403).json({ erreur: "Vous n'êtes pas affecté à cette matière." });
  const pub = await publication(cm.classeId, d.trimestre);
  if (pub?.publiee && u.role !== Role.ADMIN) return res.status(423).json({ erreur: "Les notes de ce trimestre sont déjà publiées et verrouillées." });
  if (d.valeur > d.bareme) return res.status(400).json({ erreur: "La note ne peut pas dépasser le barème." });
  const note = await prisma.note.create({ data: { ...d, saisieParId: u.userId } });
  await prisma.noteHistorique.create({ data: { noteId: note.id, utilisateurId: u.userId, nouvelleValeur: note.valeur, action: "CREATION" } });
  res.status(201).json(note);
});

notesRouter.patch("/:id", autoriserRoles(Role.ADMIN, Role.PROFESSEUR), async (req, res) => {
  const r = schemaModif.safeParse(req.body); if (!r.success) return res.status(400).json({ erreur: r.error.errors[0].message });
  const note = await prisma.note.findFirst({ where: { id: req.params.id, classeMatiere: { classe: { ecoleId: req.utilisateur!.ecoleId } } }, include: { classeMatiere: { include: { classe: true } } } });
  if (!note) return res.status(404).json({ erreur: "Note introuvable." });
  const u = req.utilisateur!; if (u.role === Role.PROFESSEUR && !(await affectationOK(u.userId, note.classeMatiereId))) return res.status(403).json({ erreur: "Vous n'êtes pas autorisé à modifier cette note." });
  const pub = await publication(note.classeMatiere.classeId, note.trimestre as Trimestre); if (pub?.publiee && u.role !== Role.ADMIN) return res.status(423).json({ erreur: "Cette note est publiée et verrouillée." });
  const valeur = r.data.valeur; const bareme = r.data.bareme ?? note.bareme; if (valeur > bareme) return res.status(400).json({ erreur: "La note ne peut pas dépasser le barème." });
  const maj = await prisma.note.update({ where: { id: note.id }, data: { valeur, bareme } });
  await prisma.noteHistorique.create({ data: { noteId: note.id, utilisateurId: u.userId, ancienneValeur: note.valeur, nouvelleValeur: valeur, action: "MODIFICATION" } });
  res.json(maj);
});

notesRouter.delete("/:id", autoriserRoles(Role.ADMIN, Role.PROFESSEUR), async (req, res) => {
  const note = await prisma.note.findFirst({ where: { id: req.params.id, classeMatiere: { classe: { ecoleId: req.utilisateur!.ecoleId } } }, include: { classeMatiere: true } });
  if (!note) return res.status(404).json({ erreur: "Note introuvable." }); const u = req.utilisateur!;
  if (u.role === Role.PROFESSEUR && note.saisieParId !== u.userId) return res.status(403).json({ erreur: "Un professeur ne peut supprimer que ses propres notes." });
  const pub = await publication(note.classeMatiere.classeId, note.trimestre as Trimestre); if (pub?.publiee && u.role !== Role.ADMIN) return res.status(423).json({ erreur: "Cette note est publiée et verrouillée." });
  await prisma.noteHistorique.create({ data: { noteId: note.id, utilisateurId: u.userId, ancienneValeur: note.valeur, action: "SUPPRESSION" } });
  await prisma.note.delete({ where: { id: note.id } }); res.status(204).send();
});

notesRouter.get("/classe/:classeId", autoriserRoles(Role.ADMIN), async (req, res) => {
  const trimestre = ((req.query.trimestre as string) || "T1") as Trimestre;
  const classe = await prisma.classe.findFirst({ where: { id: req.params.classeId, ecoleId: req.utilisateur!.ecoleId }, include: { eleves: { orderBy: [{ nom: "asc" }, { prenom: "asc" }] }, matieresClasse: { include: { matiere: true } } } });
  if (!classe) return res.status(404).json({ erreur: "Classe introuvable." });
  const notes = await prisma.note.findMany({ where: { classeMatiere: { classeId: classe.id }, trimestre }, include: { eleve: true, classeMatiere: { include: { matiere: true } }, saisiePar: { select: { id: true, nom: true, prenom: true } } }, orderBy: { eleve: { nom: "asc" } } });
  res.json({ classe, notes, classement: await calculerClassement(classe.id, trimestre), publication: await publication(classe.id, trimestre) });
});

notesRouter.get("/affectation/:classeMatiereId", autoriserRoles(Role.PROFESSEUR, Role.ADMIN), async (req, res) => {
  const cm = await prisma.classeMatiere.findFirst({ where: { id: req.params.classeMatiereId, classe: { ecoleId: req.utilisateur!.ecoleId } }, include: { classe: { include: { eleves: true } }, matiere: true } });
  if (!cm) return res.status(404).json({ erreur: "Affectation introuvable." });
  if (req.utilisateur!.role === Role.PROFESSEUR && !(await affectationOK(req.utilisateur!.userId, cm.id))) return res.status(403).json({ erreur: "Accès refusé." });
  const trimestre = ((req.query.trimestre as string) || "T1") as Trimestre;
  const notes = await prisma.note.findMany({ where: { classeMatiereId: cm.id, trimestre }, include: { eleve: true, saisiePar: { select: { nom: true, prenom: true } } } });
  res.json({ classe: cm.classe, matiere: cm.matiere, notes, publication: await publication(cm.classeId, trimestre) });
});

notesRouter.get("/eleve/:eleveId", async (req, res) => {
  const u = req.utilisateur!; const trimestre = ((req.query.trimestre as string) || "T1") as Trimestre;
  const eleve = await prisma.eleve.findFirst({ where: { id: req.params.eleveId, ecoleId: u.ecoleId }, include: { classe: true } });
  if (!eleve) return res.status(404).json({ erreur: "Élève introuvable." });
  if (u.role === Role.ELEVE && eleve.compteUtilisateurId !== u.userId) return res.status(403).json({ erreur: "Accès refusé." });
  if (u.role === Role.PARENT && !(await prisma.lienParentEleve.findFirst({ where: { parentId: u.userId, eleveId: eleve.id } }))) return res.status(403).json({ erreur: "Accès refusé." });
  if (!eleve.classeId) return res.status(400).json({ erreur: "Cet élève n'est affecté à aucune classe." });
  const pub = await publication(eleve.classeId, trimestre);
  if ((u.role === Role.ELEVE || u.role === Role.PARENT) && !pub?.publiee) return res.status(423).json({ erreur: "Les résultats ne sont pas encore publiés." });
  res.json({ ...(await calculerMoyenneEleve(eleve.id, eleve.classeId, trimestre)), classement: (await calculerClassement(eleve.classeId, trimestre)).find(x => x.eleveId === eleve.id) ?? null, publication: pub });
});

notesRouter.post("/publier", autoriserRoles(Role.ADMIN), async (req, res) => {
  const r = z.object({ classeId: z.string().uuid(), trimestre: z.nativeEnum(Trimestre), publier: z.boolean() }).safeParse(req.body); if (!r.success) return res.status(400).json({ erreur: "Données de publication invalides." });
  const classe = await prisma.classe.findFirst({ where: { id: r.data.classeId, ecoleId: req.utilisateur!.ecoleId } }); if (!classe) return res.status(404).json({ erreur: "Classe introuvable." });
  const pub = await prisma.publication.upsert({ where: { classeId_trimestre: { classeId: classe.id, trimestre: r.data.trimestre } }, update: { publiee: r.data.publier, publishedAt: r.data.publier ? new Date() : null, publieParId: req.utilisateur!.userId }, create: { classeId: classe.id, trimestre: r.data.trimestre, publiee: r.data.publier, publishedAt: r.data.publier ? new Date() : null, publieParId: req.utilisateur!.userId, ecoleId: req.utilisateur!.ecoleId } });
  await prisma.note.updateMany({ where: { classeMatiere: { classeId: classe.id }, trimestre: r.data.trimestre }, data: { publiee: r.data.publier } });
  res.json(pub);
});
