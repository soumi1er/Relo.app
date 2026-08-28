import { Router } from "express";
import { prisma } from "../lib/prisma";
import { Role } from "../types/enums";
import { authentifier, autoriserRoles } from "../middleware/auth.middleware";

export const cartesRouter = Router();
cartesRouter.use(authentifier, autoriserRoles(Role.ADMIN));

cartesRouter.get("/", async (req, res) => {
  const eleves = await prisma.eleve.findMany({
    where: { ecoleId: req.utilisateur!.ecoleId },
    include: { classe: true },
    orderBy: [{ carteDelivree: "asc" }, { nom: "asc" }, { prenom: "asc" }],
  });
  return res.json(eleves);
});

cartesRouter.post("/:eleveId/emmettre", async (req, res) => {
  const eleve = await prisma.eleve.findFirst({ where: { id: req.params.eleveId, ecoleId: req.utilisateur!.ecoleId }, include: { classe: true } });
  if (!eleve) return res.status(404).json({ erreur: "Élève introuvable." });
  const numeroCarte = eleve.numeroCarte ?? `RELO-${new Date().getFullYear()}-${eleve.id.slice(0, 8).toUpperCase()}`;
  const carte = await prisma.eleve.update({ where: { id: eleve.id }, data: { numeroCarte, carteDelivree: true, dateCarte: new Date() }, include: { classe: true } });
  return res.json(carte);
});

cartesRouter.post("/:eleveId/annuler", async (req, res) => {
  const eleve = await prisma.eleve.findFirst({ where: { id: req.params.eleveId, ecoleId: req.utilisateur!.ecoleId } });
  if (!eleve) return res.status(404).json({ erreur: "Élève introuvable." });
  const carte = await prisma.eleve.update({ where: { id: eleve.id }, data: { carteDelivree: false, dateCarte: null } });
  return res.json(carte);
});
