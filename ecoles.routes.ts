import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Role } from "../types/enums";
import { hacherMotDePasse } from "../utils/password";
import { authentifier, autoriserRoles } from "../middleware/auth.middleware";

export const ecolesRouter = Router();
const TYPES_ETABLISSEMENT = ["FONDAMENTAL", "LYCEE_GENERAL", "LYCEE_TECHNIQUE", "TECHNIQUE_PROFESSIONNEL", "MIXTE"] as const;
const schemaInscriptionEcole = z.object({
  nomEcole: z.string().trim().min(2).max(150),
  typeEtablissement: z.enum(TYPES_ETABLISSEMENT).default("LYCEE_GENERAL"),
  adresse: z.string().trim().max(250).optional(), telephone: z.string().trim().max(40).optional(),
  directeurNom: z.string().trim().max(100).optional(), directeurPrenom: z.string().trim().max(100).optional(),
  adminNom: z.string().trim().min(1).max(100), adminPrenom: z.string().trim().min(1).max(100), adminEmail: z.string().email(), adminMotDePasse: z.string().min(10).max(200),
});

// Initialisation uniquement lorsqu'aucune école n'existe encore. Cela évite qu'une personne
// puisse créer librement une nouvelle école/admin sur une installation déjà configurée.
ecolesRouter.post("/inscription", async (req, res) => {
  const resultat = schemaInscriptionEcole.safeParse(req.body);
  if (!resultat.success) return res.status(400).json({ erreur: resultat.error.errors[0].message });
  const { nomEcole, typeEtablissement, adresse, telephone, directeurNom, directeurPrenom, adminNom, adminPrenom, adminEmail, adminMotDePasse } = resultat.data;
  if (await prisma.ecole.count() > 0) return res.status(403).json({ erreur: "L'établissement est déjà initialisé. Utilisez un compte administrateur." });
  if (await prisma.utilisateur.findUnique({ where: { email: adminEmail } })) return res.status(409).json({ erreur: "Cette adresse email est déjà utilisée." });
  const motDePasseHache = await hacherMotDePasse(adminMotDePasse);
  const annee = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
  const ecole = await prisma.$transaction(async (tx) => {
    const e = await tx.ecole.create({ data: { nom: nomEcole, typeEtablissement, adresse, telephone, directeurNom, directeurPrenom } });
    await tx.utilisateur.create({ data: { nom: adminNom, prenom: adminPrenom, email: adminEmail.toLowerCase(), motDePasse: motDePasseHache, role: Role.ADMIN, ecoleId: e.id } });
    await tx.anneeScolaire.create({ data: { libelle: annee, ecoleId: e.id } });
    return e;
  });
  return res.status(201).json({ ecole: { id: ecole.id, nom: ecole.nom, typeEtablissement: ecole.typeEtablissement }, message: "Établissement créé avec succès. Choisissez maintenant vos classes selon votre type d’établissement." });
});

ecolesRouter.get("/moi", authentifier, async (req, res) => {
  const ecole = await prisma.ecole.findFirst({ where: { id: req.utilisateur!.ecoleId } });
  if (!ecole) return res.status(404).json({ erreur: "Établissement introuvable." });
  res.json(ecole);
});

ecolesRouter.patch("/moi", authentifier, autoriserRoles(Role.ADMIN), async (req, res) => {
  const schema = z.object({ nom: z.string().trim().min(2).max(150).optional(), typeEtablissement: z.enum(TYPES_ETABLISSEMENT).optional(), adresse: z.string().trim().max(250).nullable().optional(), telephone: z.string().trim().max(40).nullable().optional(), directeurNom: z.string().trim().max(100).nullable().optional(), directeurPrenom: z.string().trim().max(100).nullable().optional() });
  const r = schema.safeParse(req.body); if (!r.success) return res.status(400).json({ erreur: r.error.errors[0].message });
  const e = await prisma.ecole.update({ where: { id: req.utilisateur!.ecoleId }, data: r.data }); res.json(e);
});
