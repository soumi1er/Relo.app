import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  return bcrypt.hash(motDePasse, SALT_ROUNDS);
}

export async function verifierMotDePasse(
  motDePasse: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(motDePasse, hash);
}
