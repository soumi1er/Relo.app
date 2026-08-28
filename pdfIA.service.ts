import { LigneEleveDetectee } from "./importPdf.service";

interface ReponseIA { matricule?: unknown; nom?: unknown; prenom?: unknown; classeTexte?: unknown; dateNaissance?: unknown; sexe?: unknown; }

function texteSortie(reponse: any): string {
  if (typeof reponse.output_text === "string") return reponse.output_text;
  const morceaux: string[] = [];
  for (const sortie of reponse.output ?? []) for (const contenu of sortie.content ?? []) if (typeof contenu.text === "string") morceaux.push(contenu.text);
  return morceaux.join("\n");
}

function nettoyerLignes(lignes: ReponseIA[]): LigneEleveDetectee[] {
  let classeCourante: string | null = null;
  return lignes.map((ligne) => {
    const classeBrute = typeof ligne.classeTexte === "string" ? ligne.classeTexte.trim() || null : null;
    if (classeBrute) classeCourante = classeBrute;
    const sexe: "M" | "F" | null = ligne.sexe === "M" ? "M" : ligne.sexe === "F" ? "F" : null;
    return { texteOriginal: [ligne.matricule, ligne.nom, ligne.prenom, classeBrute ?? classeCourante, ligne.dateNaissance, ligne.sexe].filter(Boolean).join(" | "), matricule: typeof ligne.matricule === "string" ? ligne.matricule.trim() || null : null, nom: typeof ligne.nom === "string" ? ligne.nom.trim() : "", prenom: typeof ligne.prenom === "string" ? ligne.prenom.trim() : "", classeTexte: classeBrute ?? classeCourante, classeId: null, dateNaissance: typeof ligne.dateNaissance === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ligne.dateNaissance) ? ligne.dateNaissance : null, sexe };
  }).filter((ligne) => ligne.nom.length > 0 && ligne.prenom.length > 0);
}

export function iaPdfDisponible(): boolean { return Boolean(process.env.OPENAI_API_KEY); }

const schemaSortie = { type: "object", additionalProperties: false, properties: { lignes: { type: "array", items: { type: "object", additionalProperties: false, properties: { matricule: { anyOf: [{ type: "string" }, { type: "null" }] }, nom: { type: "string" }, prenom: { type: "string" }, classeTexte: { anyOf: [{ type: "string" }, { type: "null" }] }, dateNaissance: { anyOf: [{ type: "string" }, { type: "null" }] }, sexe: { anyOf: [{ type: "string" }, { type: "null" }] } }, required: ["matricule", "nom", "prenom", "classeTexte", "dateNaissance", "sexe"] } } }, required: ["lignes"] };
const consigne = "Tu es le lecteur documentaire de Relo IA pour les établissements maliens. Lis tout le document, page par page. Une classe peut être écrite dans un grand titre, un sous-titre, un en-tête de page, au-dessus d’un tableau ou dans une colonne : repère-la partout. Lorsqu’un titre de classe précède plusieurs lignes, rattache cette classe à toutes les lignes suivantes jusqu’au prochain titre de classe. Les appellations doivent rester maliennes : 1ère à 9ème année, 10ème commune, 11ème Lettres, 11ème L1, 11ème Sciences, 11ème SES, TLL, TAL, TSS, TSECO, TSExp/TSEXP, TSE, et filières techniques GM, GC, GMI, GELN, GEN, GEL, CF, GCO. Conserve toujours l’orthographe exacte imprimée dans le document : si le document écrit « 11ème L1 », retourne « 11ème L1 » et ne le remplace pas par « 11ème Lettres ». Reconstruis les colonnes même si elles sont déplacées. Retourne uniquement les élèves réellement présents. Ne devine jamais une donnée absente : utilise null.";

export async function analyserDocumentAvecIA(base64: string, mimeType: string, filename: string, texteExtrait?: string): Promise<LigneEleveDetectee[]> {
  const cle = process.env.OPENAI_API_KEY;
  if (!cle) throw new Error("Analyse IA non configurée.");
  const base = (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/+$/, "");
  const modele = process.env.OPENAI_MODEL || "gpt-5-mini";
  const contenu: any[] = [];
  if (mimeType === "application/pdf") contenu.push({ type: "input_file", filename, file_data: `data:application/pdf;base64,${base64}` });
  else if (mimeType.startsWith("image/")) contenu.push({ type: "input_image", image_url: `data:${mimeType};base64,${base64}`, detail: "high" });
  else if (texteExtrait) contenu.push({ type: "input_text", text: `Contenu extrait du document ${filename}:\n${texteExtrait.slice(0, 180000)}` });
  else throw new Error("Format documentaire non lisible.");
  contenu.push({ type: "input_text", text: consigne });
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), 90000);
  try {
    const reponse = await fetch(`${base}/responses`, { method: "POST", signal: controleur.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${cle}` }, body: JSON.stringify({ model: modele, input: [{ role: "user", content: contenu }], text: { format: { type: "json_schema", name: "liste_eleves", strict: true, schema: schemaSortie } } }) });
    if (!reponse.ok) throw new Error(`Service IA indisponible (${reponse.status}).`);
    const donnees = await reponse.json();
    const sortie = texteSortie(donnees).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const json = JSON.parse(sortie) as { lignes?: ReponseIA[] };
    return nettoyerLignes(json.lignes ?? []);
  } finally { clearTimeout(minuteur); }
}

export async function analyserPdfAvecIA(pdfBase64: string): Promise<LigneEleveDetectee[]> { return analyserDocumentAvecIA(pdfBase64, "application/pdf", "liste-eleves.pdf"); }
