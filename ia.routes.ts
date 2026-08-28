import { Router } from "express";
import { z } from "zod";
import { authentifier } from "../middleware/auth.middleware";
import { genererInsightsIA, genererReponseChat } from "../services/ia.service";

export const iaRouter = Router();

iaRouter.get("/insights", authentifier, async (req, res) => {
  if (!req.utilisateur) return res.status(401).json({ erreur: "Authentification requise." });
  try {
    const analyse = await genererInsightsIA(req.utilisateur.ecoleId);
    res.json(analyse);
  } catch (error) {
    console.error("Erreur Relo IA", error);
    res.status(500).json({ erreur: "Relo IA n’a pas pu analyser les données pour le moment." });
  }
});

const schemaChat = z.object({ message: z.string().trim().min(1).max(1200), historique: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(3000) })).max(8).optional() });

iaRouter.post("/chat", authentifier, async (req, res) => {
  if (!req.utilisateur) return res.status(401).json({ erreur: "Authentification requise." });
  const donnees = schemaChat.safeParse(req.body);
  if (!donnees.success) return res.status(400).json({ erreur: "Message invalide." });
  try {
    const reponse = await genererReponseChat(req.utilisateur.ecoleId, donnees.data.message, donnees.data.historique);
    res.json(reponse);
  } catch (error) {
    console.error("Erreur chat Relo IA", error);
    res.status(500).json({ erreur: "Relo IA ne peut pas répondre pour le moment." });
  }
});
