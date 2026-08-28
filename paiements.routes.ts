import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Role } from "../types/enums";
import { authentifier, autoriserRoles } from "../middleware/auth.middleware";

export const paiementsRouter = Router();
paiementsRouter.use(authentifier, autoriserRoles(Role.ADMIN));

const modePaiement = z.enum(["ESPECES", "ORANGE_MONEY", "MOOV_MONEY", "VIREMENT", "CHEQUE", "AUTRE"]);
const schemaDossier = z.object({
  eleveId: z.string().uuid(),
  anneeScolaireId: z.string().uuid(),
  montantTotal: z.number().min(0).max(100_000_000),
  remise: z.number().min(0).max(100_000_000).default(0),
  commentaire: z.string().trim().max(500).optional().nullable(),
});
const schemaPaiement = z.object({
  eleveId: z.string().uuid(),
  anneeScolaireId: z.string().uuid(),
  montant: z.number().positive().max(100_000_000),
  mode: modePaiement.default("ESPECES"),
  reference: z.string().trim().max(120).optional().nullable(),
  commentaire: z.string().trim().max(500).optional().nullable(),
  datePaiement: z.string().optional(),
});

async function verifierEleveEtAnnee(ecoleId: string, eleveId: string, anneeScolaireId: string) {
  const [eleve, annee] = await Promise.all([
    prisma.eleve.findFirst({ where: { id: eleveId, ecoleId }, include: { classe: true } }),
    prisma.anneeScolaire.findFirst({ where: { id: anneeScolaireId, ecoleId } }),
  ]);
  return { eleve, annee };
}

function calculerDossier(dossier: { montantTotal: number; remise: number; paiements: Array<{ montant: number }> }) {
  const totalNet = Math.max(0, dossier.montantTotal - dossier.remise);
  const paye = dossier.paiements.reduce((somme, paiement) => somme + paiement.montant, 0);
  return { totalNet, paye, reste: Math.max(0, totalNet - paye), solde: paye >= totalNet && totalNet > 0 ? "SOLDE" : paye > 0 ? "PARTIEL" : "A_PAYER" };
}

paiementsRouter.get("/synthese", async (req, res) => {
  const anneeScolaireId = String(req.query.anneeScolaireId || "");
  const annee = anneeScolaireId
    ? await prisma.anneeScolaire.findFirst({ where: { id: anneeScolaireId, ecoleId: req.utilisateur!.ecoleId } })
    : await prisma.anneeScolaire.findFirst({ where: { ecoleId: req.utilisateur!.ecoleId, active: true }, orderBy: { libelle: "desc" } });
  if (!annee) return res.status(404).json({ erreur: "Aucune année scolaire trouvée." });

  const dossiers = await prisma.dossierScolarite.findMany({ where: { ecoleId: req.utilisateur!.ecoleId, anneeScolaireId: annee.id }, include: { paiements: { select: { montant: true } } } });
  const agregat = dossiers.reduce((acc, dossier) => {
    const calcul = calculerDossier(dossier);
    acc.attendu += calcul.totalNet; acc.paye += calcul.paye;
    if (calcul.solde === "SOLDE") acc.soldes += 1;
    if (calcul.solde === "A_PAYER") acc.aPayer += 1;
    if (calcul.solde === "PARTIEL") acc.partiels += 1;
    return acc;
  }, { attendu: 0, paye: 0, soldes: 0, aPayer: 0, partiels: 0 });
  return res.json({ annee, dossiers: dossiers.length, ...agregat, reste: Math.max(0, agregat.attendu - agregat.paye) });
});

paiementsRouter.get("/", async (req, res) => {
  const anneeScolaireId = String(req.query.anneeScolaireId || "");
  const dossiers = await prisma.dossierScolarite.findMany({
    where: { ecoleId: req.utilisateur!.ecoleId, ...(anneeScolaireId ? { anneeScolaireId } : {}) },
    include: { eleve: { include: { classe: true } }, anneeScolaire: true, paiements: { orderBy: { datePaiement: "desc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return res.json(dossiers.map((dossier) => ({ ...dossier, ...calculerDossier(dossier) })));
});

paiementsRouter.get("/eleve/:eleveId", async (req, res) => {
  const anneeScolaireId = String(req.query.anneeScolaireId || "");
  const dossiers = await prisma.dossierScolarite.findMany({ where: { eleveId: req.params.eleveId, ecoleId: req.utilisateur!.ecoleId, ...(anneeScolaireId ? { anneeScolaireId } : {}) }, include: { anneeScolaire: true, paiements: { orderBy: { datePaiement: "desc" } } }, orderBy: { anneeScolaire: { libelle: "desc" } } });
  return res.json(dossiers.map((dossier) => ({ ...dossier, ...calculerDossier(dossier) })));
});

paiementsRouter.post("/dossiers", async (req, res) => {
  const resultat = schemaDossier.safeParse(req.body);
  if (!resultat.success) return res.status(400).json({ erreur: resultat.error.errors[0].message });
  if (resultat.data.remise > resultat.data.montantTotal) return res.status(400).json({ erreur: "La remise ne peut pas dépasser le montant total." });
  const { eleve, annee } = await verifierEleveEtAnnee(req.utilisateur!.ecoleId, resultat.data.eleveId, resultat.data.anneeScolaireId);
  if (!eleve || !annee) return res.status(404).json({ erreur: "Élève ou année scolaire introuvable." });
  const dossier = await prisma.dossierScolarite.upsert({
    where: { eleveId_anneeScolaireId: { eleveId: eleve.id, anneeScolaireId: annee.id } },
    update: { montantTotal: resultat.data.montantTotal, remise: resultat.data.remise, commentaire: resultat.data.commentaire ?? null },
    create: { eleveId: eleve.id, anneeScolaireId: annee.id, ecoleId: req.utilisateur!.ecoleId, montantTotal: resultat.data.montantTotal, remise: resultat.data.remise, commentaire: resultat.data.commentaire ?? null },
    include: { paiements: true, eleve: { include: { classe: true } }, anneeScolaire: true },
  });
  return res.json({ ...dossier, ...calculerDossier(dossier) });
});

paiementsRouter.post("/", async (req, res) => {
  const resultat = schemaPaiement.safeParse(req.body);
  if (!resultat.success) return res.status(400).json({ erreur: resultat.error.errors[0].message });
  const { eleve, annee } = await verifierEleveEtAnnee(req.utilisateur!.ecoleId, resultat.data.eleveId, resultat.data.anneeScolaireId);
  if (!eleve || !annee) return res.status(404).json({ erreur: "Élève ou année scolaire introuvable." });
  const dossier = await prisma.dossierScolarite.upsert({ where: { eleveId_anneeScolaireId: { eleveId: eleve.id, anneeScolaireId: annee.id } }, update: {}, create: { eleveId: eleve.id, anneeScolaireId: annee.id, ecoleId: req.utilisateur!.ecoleId }, include: { paiements: true } });
  const calcul = calculerDossier(dossier);
  if (calcul.totalNet > 0 && resultat.data.montant > calcul.reste) return res.status(400).json({ erreur: `Le paiement dépasse le reste à payer (${calcul.reste.toLocaleString("fr-FR")} FCFA).` });
  const paiement = await prisma.paiementScolarite.create({ data: { eleveId: eleve.id, dossierId: dossier.id, anneeScolaireId: annee.id, ecoleId: req.utilisateur!.ecoleId, montant: resultat.data.montant, mode: resultat.data.mode, reference: resultat.data.reference ?? null, commentaire: resultat.data.commentaire ?? null, datePaiement: resultat.data.datePaiement ? new Date(resultat.data.datePaiement) : new Date(), enregistreParId: req.utilisateur!.userId } });
  return res.status(201).json(paiement);
});

paiementsRouter.delete("/:id", async (req, res) => {
  const paiement = await prisma.paiementScolarite.findFirst({ where: { id: req.params.id, ecoleId: req.utilisateur!.ecoleId } });
  if (!paiement) return res.status(404).json({ erreur: "Paiement introuvable." });
  await prisma.paiementScolarite.delete({ where: { id: paiement.id } });
  return res.status(204).send();
});
