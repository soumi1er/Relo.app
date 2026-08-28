import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { verifierMotDePasse } from "../utils/password";
import { genererToken } from "../utils/jwt";
import { authentifier } from "../middleware/auth.middleware";
import { Role } from "../types/enums";

export const authRouter = Router();
const schemaConnexion = z.object({ email: z.string().email(), motDePasse: z.string().min(1) });
const echecs = new Map<string, { count: number; until: number }>();

async function verifierLimite(ip: string, email: string) {
  const key = `${ip}:${email.toLowerCase()}`;
  const item = echecs.get(key);
  if (item && item.until > Date.now() && item.count >= 8) return false;
  return true;
}
function enregistrerEchec(ip: string, email: string) {
  const key = `${ip}:${email.toLowerCase()}`; const old = echecs.get(key);
  const count = (old?.until && old.until > Date.now() ? old.count : 0) + 1;
  echecs.set(key, { count, until: Date.now() + 10 * 60_000 });
}
function reinitialiser(ip: string, email: string) { echecs.delete(`${ip}:${email.toLowerCase()}`); }

authRouter.post("/login", async (req, res) => {
  const r = schemaConnexion.safeParse(req.body); if (!r.success) return res.status(400).json({ erreur: "Identifiants invalides." });
  const { email, motDePasse } = r.data;
  if (!(await verifierLimite(req.ip ?? "inconnue", email))) return res.status(429).json({ erreur: "Trop de tentatives. Réessayez dans quelques minutes." });
  const utilisateur = await prisma.utilisateur.findUnique({ where: { email: email.toLowerCase() } });
  if (!utilisateur || !utilisateur.actif || !(await verifierMotDePasse(motDePasse, utilisateur.motDePasse))) {
    enregistrerEchec(req.ip ?? "inconnue", email); return res.status(401).json({ erreur: "Identifiants incorrects." });
  }
  reinitialiser(req.ip ?? "inconnue", email);
  const token = genererToken({ userId: utilisateur.id, ecoleId: utilisateur.ecoleId, role: utilisateur.role as Role });
  return res.json({ token, utilisateur: { id: utilisateur.id, nom: utilisateur.nom, prenom: utilisateur.prenom, email: utilisateur.email, role: utilisateur.role } });
});

authRouter.get("/moi", authentifier, async (req, res) => {
  const utilisateur = await prisma.utilisateur.findFirst({ where: { id: req.utilisateur!.userId, ecoleId: req.utilisateur!.ecoleId }, select: { id: true, nom: true, prenom: true, email: true, role: true, ecoleId: true } });
  if (!utilisateur) return res.status(404).json({ erreur: "Utilisateur introuvable." });
  res.json(utilisateur);
});
