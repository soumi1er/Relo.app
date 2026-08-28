import { SEPARATEUR_COLONNE } from "./pdfExtraction.service";

export interface ClasseConnue { id: string; nom: string; }

export interface LigneEleveDetectee {
  texteOriginal: string;
  matricule: string | null;
  nom: string;
  prenom: string;
  classeTexte: string | null;
  classeId: string | null;
  dateNaissance: string | null;
  sexe: "M" | "F" | null;
}

type Champ = "matricule" | "nom" | "prenom" | "nomComplet" | "classe" | "dateNaissance" | "sexe" | "inconnu";

const MOTIF_CLASSE = /\b(CI|CP|CE1|CE2|CM1|CM2|[3-9]\s?[eè]me?|10\s?[eè]me?|11\s?[eè]me?|12\s?[eè]me?|CAP|BT|TLL|TAL|TSS|TSECO|TSEXP|TSE)\b(?:\s+[A-Z][A-Z0-9-]{0,7})?/i;
const MOTIF_DATE = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;
const MOTIF_SEXE_ISOLE = /(?:^|\s)(M|F|H)(?:\s|$)/i;
const MOTIF_MATRICULE = /^(?=.*\d)[A-Z0-9][A-Z0-9/_-]{3,}$/i;

function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function capitaliser(mot: string): string {
  if (!mot) return mot;
  return mot.charAt(0).toUpperCase() + mot.slice(1).toLowerCase();
}

function estLigneUtile(ligne: string): boolean {
  const l = ligne.trim();
  if (l.length < 2) return false;
  const n = normaliser(l);
  if (/^(liste|effectif|etablissement|ecole|annee scolaire|page\s*\d|nom\s+prenom)/.test(n)) return false;
  if (/^[\d.\-\s]+$/.test(l)) return false;
  return true;
}

function identifierChampEntete(cellule: string): Champ {
  const c = normaliser(cellule);
  if (/matric|mat\.?\b|identifiant|numero/.test(c)) return "matricule";
  if (/naissance|ddn|nais/.test(c)) return "dateNaissance";
  if (/\bsexe\b|\bgenre\b/.test(c)) return "sexe";
  if (/classe|niveau|serie|filiere|section/.test(c)) return "classe";
  if (/prenom/.test(c) && /\bnom\b/.test(c)) return "nomComplet";
  if (/prenom/.test(c)) return "prenom";
  if (/\bnom\b/.test(c)) return "nom";
  return "inconnu";
}

function detecterEntete(lignes: string[]): { index: number; colonnes: Champ[] } | null {
  const limite = Math.min(lignes.length, 12);
  for (let i = 0; i < limite; i++) {
    const cellules = lignes[i].includes(SEPARATEUR_COLONNE) ? lignes[i].split(SEPARATEUR_COLONNE).map((c) => c.trim()) : lignes[i].split(/\s{2,}/).map((c) => c.trim());
    const colonnes = cellules.map(identifierChampEntete);
    if (colonnes.filter((c) => c !== "inconnu").length >= 2) return { index: i, colonnes };
  }
  return null;
}

function normaliserDateNaissance(brut: string): string | null {
  const m = brut.match(MOTIF_DATE);
  if (!m) return null;
  const jour = m[1].padStart(2, "0");
  const mois = m[2].padStart(2, "0");
  let annee = m[3];
  if (annee.length === 2) annee = (Number(annee) > 30 ? "19" : "20") + annee;
  const iso = `${annee}-${mois}-${jour}`;
  return isNaN(Date.parse(iso)) ? null : iso;
}

function normaliserSexe(brut: string): "M" | "F" | null {
  const c = normaliser(brut);
  if (/^(m|masculin|garcon|homme|h)$/.test(c)) return "M";
  if (/^(f|feminin|fille|femme)$/.test(c)) return "F";
  return null;
}

function separerNomPrenom(texte: string): { nom: string; prenom: string } {
  const mots = texte.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return { nom: "", prenom: "" };
  if (mots.length === 1) return { nom: capitaliser(mots[0]), prenom: "" };
  const estMajuscule = (m: string) => m.length > 1 && m === m.toUpperCase() && m !== m.toLowerCase();
  const motsNom: string[] = [];
  let i = 0;
  while (i < mots.length && estMajuscule(mots[i])) { motsNom.push(mots[i]); i++; }
  if (motsNom.length === 0) return { nom: capitaliser(mots[0]), prenom: mots.slice(1).map(capitaliser).join(" ") };
  return { nom: motsNom.map(capitaliser).join(" "), prenom: mots.slice(i).map(capitaliser).join(" ") };
}

function resoudreClasse(texte: string, classesExistantes: ClasseConnue[]): { classeTexte: string | null; classeId: string | null } {
  if (!texte) return { classeTexte: null, classeId: null };
  const n = normaliser(texte);
  const classe = classesExistantes.slice().sort((a, b) => b.nom.length - a.nom.length).find((c) => n.includes(normaliser(c.nom)) || normaliser(c.nom).includes(n));
  if (classe) return { classeTexte: classe.nom, classeId: classe.id };
  const motif = texte.match(MOTIF_CLASSE);
  return { classeTexte: motif ? motif[0].trim() : texte.trim() || null, classeId: null };
}

function detecterClasseAutonome(texte: string, classesExistantes: ClasseConnue[]): { classeTexte: string | null; classeId: string | null } {
  const connue = classesExistantes.slice().sort((a, b) => b.nom.length - a.nom.length).find((c) => normaliser(texte).includes(normaliser(c.nom)));
  if (connue) return { classeTexte: connue.nom, classeId: connue.id };
  const motif = texte.match(/\b(?:CI|CP|CE1|CE2|CM1|CM2|[3-9]\s?[eè]me?|10\s?[eè]me?|11\s?[eè]me?|12\s?[eè]me?|CAP|BT|TLL|TAL|TSS|TSECO|TSEXP|TSE)(?:\s+[A-ZÀ-ÿ][A-ZÀ-ÿ0-9-]{0,12}){0,2}/i);
  return motif ? resoudreClasse(motif[0].trim(), classesExistantes) : { classeTexte: null, classeId: null };
}

function estEnteteDeClasse(ligne: string, classesExistantes: ClasseConnue[]): boolean {
  const classe = detecterClasseAutonome(ligne, classesExistantes);
  return Boolean(classe.classeTexte && ligne.length <= 80 && !MOTIF_DATE.test(ligne) && !MOTIF_SEXE_ISOLE.test(ligne) && !/\b\d{4,}\b/.test(ligne));
}

function analyserLigneLibre(ligne: string, classesExistantes: ClasseConnue[]): LigneEleveDetectee | null {
  let reste = ligne.trim();
  let matricule: string | null = null;
  const premierMot = reste.split(/\s+/)[0]?.replace(/[,:;]$/, "") ?? "";
  if (MOTIF_MATRICULE.test(premierMot) && /\d/.test(premierMot)) {
    matricule = premierMot;
    reste = reste.slice(premierMot.length).trim();
  }

  const mMatricule = reste.match(/\b[A-ZÀ-ÿ]{2,}[A-ZÀ-ÿ0-9/_-]*\d[A-ZÀ-ÿ0-9/_-]{2,}\b/i);
  if (mMatricule) { matricule = mMatricule[0].replace(/[,:;]$/, ""); reste = (reste.slice(0, mMatricule.index) + reste.slice((mMatricule.index ?? 0) + mMatricule[0].length)).replace(/\s+/g, " ").trim(); }

  let dateNaissance: string | null = null;
  const mDate = reste.match(MOTIF_DATE);
  if (mDate) {
    dateNaissance = normaliserDateNaissance(mDate[0]);
    reste = (reste.slice(0, mDate.index) + reste.slice((mDate.index ?? 0) + mDate[0].length)).trim();
  }

  let sexe: "M" | "F" | null = null;
  const mSexe = reste.match(MOTIF_SEXE_ISOLE);
  if (mSexe) {
    sexe = normaliserSexe(mSexe[1]);
    reste = (reste.slice(0, mSexe.index) + reste.slice((mSexe.index ?? 0) + mSexe[0].length)).replace(/\s+/g, " ").trim();
  }

  let classeTexte: string | null = null;
  let classeId: string | null = null;
  const classeConnue = classesExistantes.slice().sort((a, b) => b.nom.length - a.nom.length).find((c) => normaliser(reste).includes(normaliser(c.nom)));
  if (classeConnue) {
    classeTexte = classeConnue.nom; classeId = classeConnue.id;
    reste = reste.replace(new RegExp(classeConnue.nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ").replace(/\s+/g, " ").trim();
  } else {
    const motif = reste.match(MOTIF_CLASSE);
    if (motif) { classeTexte = motif[0].trim(); reste = (reste.slice(0, motif.index) + reste.slice((motif.index ?? 0) + motif[0].length)).replace(/\s+/g, " ").trim(); }
  }

  reste = reste.replace(/^\d+\s*[.\-):]?\s*/, "").trim();
  if (!reste) return null;
  const { nom, prenom } = separerNomPrenom(reste);
  if (!nom || !prenom) return null;
  return { texteOriginal: ligne, matricule, nom, prenom, classeTexte, classeId, dateNaissance, sexe };
}

export function analyserTextePdfEleves(texte: string, classesExistantes: ClasseConnue[]): LigneEleveDetectee[] {
  const lignesBrutes = texte.split(/\r?\n/).map((l) => l.includes(SEPARATEUR_COLONNE) ? l.trim() : l.replace(/\s+/g, " ").trim()).filter(estLigneUtile);
  const entete = detecterEntete(lignesBrutes);
  const resultats: LigneEleveDetectee[] = [];

  let classeContexte: { classeTexte: string | null; classeId: string | null } = { classeTexte: null, classeId: null };

  if (entete) {
    for (let i = 0; i < lignesBrutes.length; i++) {
      const ligne = lignesBrutes[i];
      if (estEnteteDeClasse(ligne, classesExistantes)) { classeContexte = detecterClasseAutonome(ligne, classesExistantes); continue; }
      const cellules = ligne.includes(SEPARATEUR_COLONNE) ? ligne.split(SEPARATEUR_COLONNE).map((c) => c.trim()) : ligne.split(/\s{2,}/).map((c) => c.trim());
      const colonnesLigne = cellules.map(identifierChampEntete);
      if (i === entete.index || colonnesLigne.join(",") === entete.colonnes.join(",")) continue;
      if (cellules.length < 2) continue;

      let matricule = ""; let nom = ""; let prenom = ""; let classeBrute = ""; let dateBrute = ""; let sexeBrut = "";
      for (let c = 0; c < Math.min(cellules.length, entete.colonnes.length); c++) {
        const valeur = cellules[c];
        switch (entete.colonnes[c]) {
          case "matricule": matricule = valeur; break;
          case "nom": nom = valeur; break;
          case "prenom": prenom = valeur; break;
          case "nomComplet": { const s = separerNomPrenom(valeur); nom = s.nom; prenom = s.prenom; break; }
          case "classe": classeBrute = valeur; break;
          case "dateNaissance": dateBrute = valeur; break;
          case "sexe": sexeBrut = valeur; break;
        }
      }
      if (!nom || !prenom) continue;
      const classe = resoudreClasse(classeBrute, classesExistantes);
      const classeFinale = classe.classeTexte ? classe : classeContexte;
      resultats.push({ texteOriginal: ligne, matricule: matricule || null, nom: nom === nom.toUpperCase() ? nom : capitaliser(nom), prenom: prenom.split(/\s+/).filter(Boolean).map(capitaliser).join(" "), classeTexte: classeFinale.classeTexte, classeId: classeFinale.classeId, dateNaissance: dateBrute ? normaliserDateNaissance(dateBrute) : null, sexe: sexeBrut ? normaliserSexe(sexeBrut) : null });
    }
  } else {
    for (const ligne of lignesBrutes) {
      if (estEnteteDeClasse(ligne, classesExistantes)) { classeContexte = detecterClasseAutonome(ligne, classesExistantes); continue; }
      const resultat = analyserLigneLibre(ligne, classesExistantes);
      if (resultat && !resultat.classeTexte && classeContexte.classeTexte) resultats.push({ ...resultat, classeTexte: classeContexte.classeTexte, classeId: classeContexte.classeId });
      else if (resultat) resultats.push(resultat);
    }
  }
  return resultats;
}
