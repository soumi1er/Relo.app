import { Router } from "express";
import { Role, Trimestre } from "../types/enums";
import { prisma } from "../lib/prisma";
import { authentifier } from "../middleware/auth.middleware";
import { genererBulletinPDF } from "../services/bulletin.service";

export const bulletinsRouter = Router();
bulletinsRouter.use(authentifier);

/**
 * GET /api/bulletins/:eleveId?trimestre=T1
 * Télécharge le bulletin PDF d'un élève.
 * Accessible à l'admin, au professeur, et au parent/élève concerné uniquement.
 */
bulletinsRouter.get("/:eleveId", async (req, res) => {
  const { role, userId, ecoleId } = req.utilisateur!;
  const trimestre = (req.query.trimestre as Trimestre) || Trimestre.T1;

  const eleve = await prisma.eleve.findFirst({
    where: { id: req.params.eleveId, ecoleId },
  });
  if (!eleve) {
    return res.status(404).json({ erreur: "Élève introuvable." });
  }

  if (role === Role.ELEVE && eleve.compteUtilisateurId !== userId) {
    return res.status(403).json({ erreur: "Accès refusé." });
  }
  if (role === Role.PARENT) {
    const lien = await prisma.lienParentEleve.findFirst({
      where: { parentId: userId, eleveId: eleve.id },
    });
    if (!lien) {
      return res.status(403).json({ erreur: "Accès refusé." });
    }
  }

  if ((role === Role.ELEVE || role === Role.PARENT) && eleve.classeId) {
    const publication = await prisma.publication.findUnique({ where: { classeId_trimestre: { classeId: eleve.classeId, trimestre } } });
    if (!publication?.publiee) return res.status(423).json({ erreur: "Les résultats ne sont pas encore publiés." });
  }

  try {
    const pdfBuffer = await genererBulletinPDF(eleve.id, trimestre);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="bulletin-${eleve.matricule}-${trimestre}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (erreur: any) {
    return res.status(400).json({ erreur: erreur.message || "Erreur de génération du bulletin." });
  }
});
