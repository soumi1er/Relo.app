// Génère un matricule lisible et unique pour un élève : ex. RELO-2026-4F7A2C
export function genererMatricule(): string {
  const annee = new Date().getFullYear();
  const suffixe = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RELO-${annee}-${suffixe}`;
}
