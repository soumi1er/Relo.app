import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { Role } from "../types/enums";

const dossierDonnees = process.env.RELO_DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(dossierDonnees)) fs.mkdirSync(dossierDonnees, { recursive: true });
const fichierSecret = path.join(dossierDonnees, ".jwt-secret");
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (fs.existsSync(fichierSecret)) JWT_SECRET = fs.readFileSync(fichierSecret, "utf8").trim();
  else { JWT_SECRET = randomBytes(48).toString("hex"); fs.writeFileSync(fichierSecret, JWT_SECRET, { mode: 0o600 }); }
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

export interface TokenPayload { userId: string; ecoleId: string; role: Role; }
export function genererToken(payload: TokenPayload): string { return jwt.sign(payload, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions); }
export function verifierToken(token: string): TokenPayload { return jwt.verify(token, JWT_SECRET!) as TokenPayload; }
