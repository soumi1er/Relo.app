import { prisma } from "../lib/prisma";

export interface InsightIA { id: string; niveau: "prioritaire" | "attention" | "positif"; titre: string; detail: string; action: string; meta: string; to: string; }
export interface ResumeIA { insights: InsightIA[]; stats: { classes: number; eleves: number; notes: number; couverture: number; notesNonPubliees: number; moyenne: number | null; }; }
export interface MessageChatIA { role: "user" | "assistant"; content: string; }
export interface ReponseChatIA { message: string; actions: Array<{ label: string; to: string }>; source: "ia" | "local"; }

const secours: InsightIA[] = [
  { id: "local-1", niveau: "prioritaire", titre: "Vérifier les évaluations incomplètes", detail: "Relo IA a besoin de notes récentes pour identifier les élèves qui décrochent.", action: "Ouvrir les notes", meta: "Qualité des données", to: "/notes" },
  { id: "local-2", niveau: "attention", titre: "Comparer les moyennes par série", detail: "Une lecture par niveau et par filière permet de mieux cibler les accompagnements.", action: "Voir les classes", meta: "Analyse pédagogique", to: "/classes" },
  { id: "local-3", niveau: "positif", titre: "Le suivi est prêt à progresser", detail: "Les données sont centralisées : chaque nouvelle note améliore la précision des recommandations.", action: "Continuer", meta: "Relo IA", to: "/eleves" },
];

function destination(action: unknown): string { const texte = String(action ?? "").toLowerCase(); if (texte.includes("import")) return "/eleves/importer"; if (texte.includes("classe") || texte.includes("série") || texte.includes("filière")) return "/classes"; if (texte.includes("passage") || texte.includes("redouble")) return "/promotion"; if (texte.includes("élève") || texte.includes("eleve")) return "/eleves"; return "/notes"; }
function normaliserInsight(brut: Partial<InsightIA>, index: number): InsightIA { return { id: String(brut.id ?? `ia-${index}`), niveau: brut.niveau === "prioritaire" || brut.niveau === "attention" ? brut.niveau : "positif", titre: String(brut.titre ?? "Signal à examiner"), detail: String(brut.detail ?? "Relo IA recommande une vérification dans les données de l’établissement."), action: String(brut.action ?? "Ouvrir le dossier"), meta: String(brut.meta ?? "Relo IA"), to: typeof brut.to === "string" && brut.to.startsWith("/") ? brut.to : destination(brut.action) }; }
function nettoyerJson(texte: string): string { return texte.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim(); }

async function construireContexte(ecoleId: string) {
  const [classes, eleves, notes] = await Promise.all([
    prisma.classe.findMany({ where: { ecoleId }, select: { id: true, nom: true, cycle: true, niveauCode: true, filiereCode: true, _count: { select: { eleves: true } } }, take: 100 }),
    prisma.eleve.findMany({ where: { ecoleId }, select: { id: true, nom: true, prenom: true, classeId: true, classe: { select: { nom: true, filiereCode: true } } }, take: 500 }),
    prisma.note.findMany({ where: { eleve: { ecoleId } }, select: { valeur: true, bareme: true, trimestre: true, publiee: true }, take: 2000 }),
  ]);
  const moyenne = notes.length ? Math.round((notes.reduce((total, note) => total + (note.valeur / note.bareme) * 20, 0) / notes.length) * 10) / 10 : null;
  const stats = { classes: classes.length, eleves: eleves.length, notes: notes.length, couverture: notes.length ? Math.round((notes.filter((note) => note.valeur !== null).length / notes.length) * 100) : 0, notesNonPubliees: notes.filter((note) => !note.publiee).length, moyenne };
  return { stats, contexte: { etablissement: stats, classes: classes.map((classe) => ({ id: classe.id, nom: classe.nom, cycle: classe.cycle, niveau: classe.niveauCode, filiere: classe.filiereCode, effectif: classe._count.eleves })), eleves: { total: eleves.length, sansClasse: eleves.filter((eleve) => !eleve.classeId).length }, notes: { moyenne, nonPubliees: stats.notesNonPubliees, parTrimestre: [...new Set(notes.map((note) => note.trimestre))] } } };
}

export async function genererInsightsIA(ecoleId: string): Promise<ResumeIA> {
  const { stats, contexte } = await construireContexte(ecoleId);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { insights: genererInsightsSecours(contexte), stats };
  try {
    const base = (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");
    const response = await fetch(`${base}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5-mini", max_completion_tokens: 1200, messages: [{ role: "system", content: "Tu es Relo IA, copilote d’analyse scolaire pour un établissement malien. Retourne uniquement un tableau JSON de trois à cinq objets avec id, niveau (prioritaire|attention|positif), titre, detail, action, meta et to. Le champ to doit être une vraie route parmi /eleves, /eleves/importer, /classes, /notes ou /promotion. Ne fabrique aucune donnée." }, { role: "user", content: `Analyse ce contexte anonymisé et propose des actions concrètes : ${JSON.stringify(contexte)}` }] }) });
    if (!response.ok) return { insights: genererInsightsSecours(contexte), stats };
    const donnees = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const contenu = donnees.choices?.[0]?.message?.content;
    if (!contenu) return { insights: genererInsightsSecours(contexte), stats };
    const resultat = JSON.parse(nettoyerJson(contenu));
    const tableau = Array.isArray(resultat) ? resultat : resultat.insights;
    return { insights: Array.isArray(tableau) && tableau.length ? tableau.slice(0, 5).map(normaliserInsight) : genererInsightsSecours(contexte), stats };
  } catch { return { insights: genererInsightsSecours(contexte), stats }; }
}

export async function genererReponseChat(ecoleId: string, message: string, historique: MessageChatIA[] = []): Promise<ReponseChatIA> {
  const { contexte } = await construireContexte(ecoleId);
  const apiKey = process.env.OPENAI_API_KEY;
  const actions = [{ label: "Voir les élèves", to: "/eleves" }, { label: "Ouvrir les classes", to: "/classes" }, { label: "Vérifier les notes", to: "/notes" }, { label: "Importer un document", to: "/eleves/importer" }];
  if (!apiKey) return { source: "local", actions, message: `Je peux déjà vous aider avec les données disponibles : ${contexte.etablissement.eleves} élève(s), ${contexte.etablissement.classes} classe(s) et ${contexte.etablissement.notes} note(s). ${contexte.eleves.sansClasse ? `${contexte.eleves.sansClasse} élève(s) sont encore sans classe.` : "Tous les élèves connus sont rattachés à une classe."}` };
  try {
    const base = (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");
    const messages = [{ role: "system", content: "Tu es Relo IA, l’assistant opérationnel d’un établissement scolaire malien. Réponds en français, de façon concise et concrète. Utilise uniquement le contexte fourni. Ne prétends jamais avoir effectué une action : explique plutôt l’action à réaliser dans Relo. Tu peux parler des élèves, classes, filières, notes, imports et décisions scolaires. Ne révèle aucune donnée inutile et ne demande jamais de mot de passe." }, ...historique.slice(-8), { role: "user", content: `Contexte réel anonymisé : ${JSON.stringify(contexte)}\n\nQuestion de l’utilisateur : ${message}` }];
    const response = await fetch(`${base}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5-mini", max_completion_tokens: 800, messages }) });
    if (!response.ok) throw new Error("IA indisponible");
    const donnees = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const contenu = donnees.choices?.[0]?.message?.content?.trim();
    if (!contenu) throw new Error("Réponse IA vide");
    return { source: "ia", actions, message: contenu };
  } catch { return { source: "local", actions, message: `Je n’ai pas pu joindre le moteur IA, mais voici l’état connu : ${contexte.etablissement.classes} classe(s), ${contexte.etablissement.eleves} élève(s), ${contexte.etablissement.notes} note(s). Vous pouvez poursuivre depuis les actions ci-dessous.` }; }
}

function genererInsightsSecours(contexte: { etablissement: { classes: number; eleves: number; notes: number }; notes: { moyenne: number | null; nonPubliees: number }; eleves: { sansClasse: number } }): InsightIA[] {
  const insights = secours.map((item) => ({ ...item }));
  if (contexte.etablissement.classes === 0) insights[0] = { ...insights[0], titre: "Créer la première classe", detail: "Aucune classe n’est encore rattachée à l’établissement. Configurez les niveaux et filières ouverts.", action: "Configurer les classes", meta: "Organisation", to: "/classes" };
  else if (contexte.eleves.sansClasse > 0) insights[0] = { ...insights[0], titre: `${contexte.eleves.sansClasse} élève(s) sans classe`, detail: "Vérifiez les affectations avant de préparer les bulletins.", action: "Voir les élèves", meta: "Dossiers élèves", to: "/eleves" };
  if (contexte.etablissement.notes > 0 && contexte.notes.moyenne !== null) insights[1] = { ...insights[1], titre: `Moyenne observée : ${contexte.notes.moyenne}/20`, detail: `${contexte.notes.nonPubliees} note(s) restent non publiée(s). Vérifiez la cohérence avant de communiquer les résultats.`, meta: "Notes & publication", to: "/notes" };
  if (contexte.etablissement.eleves === 0) insights[2] = { ...insights[2], titre: "Importer une liste d’élèves", detail: "Aucun dossier élève n’est encore disponible. Relo IA peut lire un PDF, une image, un Word ou un Excel.", action: "Importer un document", meta: "Dossiers élèves", to: "/eleves/importer" };
  return insights;
}
