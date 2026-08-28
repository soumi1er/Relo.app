import { Router } from "express";
import { z } from "zod";
import { Role } from "../types/enums";
import { prisma } from "../lib/prisma";
import { authentifier, autoriserRoles } from "../middleware/auth.middleware";
import { calculerPromotionsClasse, affecterNouvelleClasse, obtenirEtatCloture, preparerClotureAnnuelle, finaliserClotureAnnuelle } from "../services/promotion.service";

export const promotionRouter = Router();
promotionRouter.use(authentifier, autoriserRoles(Role.ADMIN));

const schemaCalcul = z.object({
  classeId: z.string().uuid(),
  anneeScolaireId: z.string().uuid(),
});

/**
 * POST /api/promotion/calculer
 * Calcule et enregistre la décision de passage/redoublement de tous les élèves
 * d'une classe pour l'année scolaire indiquée. Réservé à l'administration.
 */
promotionRouter.post("/calculer", async (req, res) => {
  const resultat = schemaCalcul.safeParse(req.body);
  if (!resultat.success) {
    return res.status(400).json({ erreur: resultat.error.errors[0].message });
  }

  const classe = await prisma.classe.findFirst({
    where: { id: resultat.data.classeId, ecoleId: req.utilisateur!.ecoleId },
  });
  if (!classe) {
    return res.status(404).json({ erreur: "Classe introuvable." });
  }

  const resultats = await calculerPromotionsClasse(
    resultat.data.classeId,
    resultat.data.anneeScolaireId
  );

  return res.json(resultats);
});

const schemaCloture = z.object({ anneeScolaireId: z.string().uuid(), anneeCibleId: z.string().uuid().optional() });

promotionRouter.get("/cloture", async (req, res) => {
  const anneeScolaireId = String(req.query.anneeScolaireId || "");
  const resultat = schemaCloture.safeParse({ anneeScolaireId });
  if (!resultat.success) return res.status(400).json({ erreur: "Année scolaire source invalide." });
  try { return res.json(await obtenirEtatCloture(req.utilisateur!.ecoleId, resultat.data.anneeScolaireId)); }
  catch (err) { return res.status(404).json({ erreur: err instanceof Error ? err.message : "Impossible de lire l’état de clôture." }); }
});

promotionRouter.post("/cloture/apercu", async (req, res) => {
  const resultat = schemaCloture.safeParse(req.body);
  if (!resultat.success) return res.status(400).json({ erreur: resultat.error.errors[0].message });
  try { return res.json(await preparerClotureAnnuelle(req.utilisateur!.ecoleId, resultat.data.anneeScolaireId)); }
  catch (err) { return res.status(400).json({ erreur: err instanceof Error ? err.message : "Impossible de préparer la clôture." }); }
});

promotionRouter.post("/cloture/finaliser", async (req, res) => {
  const resultat = schemaCloture.safeParse(req.body);
  if (!resultat.success) return res.status(400).json({ erreur: resultat.error.errors[0].message });
  try { return res.json(await finaliserClotureAnnuelle(req.utilisateur!.ecoleId, resultat.data.anneeScolaireId, resultat.data.anneeCibleId)); }
  catch (err) { return res.status(409).json({ erreur: err instanceof Error ? err.message : "La clôture annuelle n’a pas pu être finalisée." }); }
});

const schemaAffectation = z.object({
  eleveId: z.string().uuid(),
  nouvelleClasseId: z.string().uuid(),
});

// POST /api/promotion/affecter — affecter un élève (promu ou redoublant) à sa classe de l'année suivante
promotionRouter.post("/affecter", async (req, res) => {
  const resultat = schemaAffectation.safeParse(req.body);
  if (!resultat.success) {
    return res.status(400).json({ erreur: resultat.error.errors[0].message });
  }

  const eleve = await prisma.eleve.findFirst({
    where: { id: resultat.data.eleveId, ecoleId: req.utilisateur!.ecoleId },
  });
  const nouvelleClasse = await prisma.classe.findFirst({
    where: { id: resultat.data.nouvelleClasseId, ecoleId: req.utilisateur!.ecoleId },
  });

  if (!eleve || !nouvelleClasse) {
    return res.status(404).json({ erreur: "Élève ou classe introuvable." });
  }

  const eleveMaj = await affecterNouvelleClasse(
    resultat.data.eleveId,
    resultat.data.nouvelleClasseId
  );

  return res.json(eleveMaj);
});
