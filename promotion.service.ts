import { Decision, StatutEleve } from "../types/enums";
import { prisma } from "../lib/prisma";
import { calculerMoyenneAnnuelle } from "./calcul.service";

const MOYENNE_PASSAGE = Number(process.env.MOYENNE_PASSAGE || 10);

export interface ResultatPromotion {
  eleveId: string;
  nom: string;
  prenom: string;
  moyenneAnnuelle: number | null;
  decision: Decision;
}

/**
 * Calcule et enregistre la décision de passage/redoublement pour TOUS les élèves
 * d'une classe, pour une année scolaire donnée. À lancer par l'administration
 * en fin d'année scolaire, une fois toutes les notes saisies.
 *
 * Règle appliquée : moyenne annuelle >= MOYENNE_PASSAGE (paramétrable via .env,
 * 10/20 par défaut) => PASSE, sinon REDOUBLE.
 * Un élève sans aucune moyenne calculable (aucune note saisie) est considéré
 * REDOUBLE par prudence, et signalé pour vérification manuelle.
 */
export async function calculerPromotionsClasse(
  classeId: string,
  anneeScolaireId: string
): Promise<ResultatPromotion[]> {
  const classe = await prisma.classe.findUnique({
    where: { id: classeId },
    include: { eleves: true },
  });

  if (!classe) {
    throw new Error("Classe introuvable.");
  }

  const resultats: ResultatPromotion[] = [];

  for (const eleve of classe.eleves) {
    const moyenneAnnuelle = await calculerMoyenneAnnuelle(eleve.id, classeId);
    const decision: Decision =
      moyenneAnnuelle !== null && moyenneAnnuelle >= MOYENNE_PASSAGE
        ? Decision.PASSE
        : Decision.REDOUBLE;

    await prisma.historiqueScolaire.upsert({
      where: { eleveId_anneeScolaireId: { eleveId: eleve.id, anneeScolaireId } },
      update: {
        classeNom: classe.nom,
        moyenneAnnuelle: moyenneAnnuelle ?? 0,
        decision,
      },
      create: {
        eleveId: eleve.id,
        anneeScolaireId,
        classeNom: classe.nom,
        moyenneAnnuelle: moyenneAnnuelle ?? 0,
        decision,
      },
    });

    await prisma.eleve.update({
      where: { id: eleve.id },
      data: {
        statut: decision === Decision.PASSE ? StatutEleve.PROMU : StatutEleve.REDOUBLANT,
      },
    });

    resultats.push({
      eleveId: eleve.id,
      nom: eleve.nom,
      prenom: eleve.prenom,
      moyenneAnnuelle,
      decision,
    });
  }

  return resultats;
}

/**
 * Affecte un élève promu à sa nouvelle classe pour l'année scolaire suivante.
 * Un redoublant reste inscrit sur la même classe (nom identique) l'année suivante ;
 * c'est à l'administration de créer/choisir la bonne classe cible dans les deux cas.
 */
export async function affecterNouvelleClasse(eleveId: string, nouvelleClasseId: string) {
  return prisma.eleve.update({
    where: { id: eleveId },
    data: { classeId: nouvelleClasseId, statut: StatutEleve.ACTIF },
  });
}


export interface EtatCloture {
  annee: { id: string; libelle: string };
  classes: number;
  publicationsAttendues: number;
  publicationsValides: number;
  publicationsManquantes: Array<{ classeId: string; classeNom: string; trimestre: string }>;
  prete: boolean;
}

export interface LigneCloture extends ResultatPromotion {
  classeId: string;
  classeNom: string;
  niveauSuivant: string | null;
  classeCibleNom: string | null;
}

const niveauxSuperieurs: Record<string, { code: string; label: string }> = {
  "1A": { code: "2A", label: "2ème année" }, "2A": { code: "3A", label: "3ème année" }, "3A": { code: "4A", label: "4ème année" },
  "4A": { code: "5A", label: "5ème année" }, "5A": { code: "6A", label: "6ème année" }, "6A": { code: "7A", label: "7ème année" },
  "7A": { code: "8A", label: "8ème année" }, "8A": { code: "9A", label: "9ème année" }, "10EME": { code: "11EME", label: "11ème" },
  "11EME": { code: "12EME", label: "12ème" },
};

function ciblePourClasse(classe: { nom: string; niveauCode: string | null; filiereCode: string | null }) {
  const niveau = classe.niveauCode ? niveauxSuperieurs[classe.niveauCode] : undefined;
  if (!niveau) return { niveauSuivant: null, classeCibleNom: null };
  const suffixe = classe.nom.replace(/^(?:1ère|2ème|3ème|4ème|5ème|6ème|7ème|8ème|9ème|10ème|11ème|12ème|1A|2A|3A|4A|5A|6A|7A|8A|9A|10EME|11EME|12EME)\s*/i, "").trim();
  return { niveauSuivant: niveau.code, classeCibleNom: `${niveau.label}${suffixe ? ` ${suffixe}` : classe.filiereCode && classe.filiereCode !== "COMMUNE" ? ` ${classe.filiereCode}` : ""}`.trim() };
}

async function verifierEtatCloture(ecoleId: string, anneeScolaireId: string): Promise<EtatCloture> {
  const annee = await prisma.anneeScolaire.findFirst({ where: { id: anneeScolaireId, ecoleId }, select: { id: true, libelle: true } });
  if (!annee) throw new Error("Année scolaire introuvable.");
  const classes = await prisma.classe.findMany({ where: { ecoleId, anneeScolaireId }, select: { id: true, nom: true } });
  const publications = await prisma.publication.findMany({ where: { ecoleId, classeId: { in: classes.map((c) => c.id) } }, select: { classeId: true, trimestre: true, publiee: true } });
  const publicationMap = new Map(publications.map((publication) => [`${publication.classeId}:${publication.trimestre}`, publication.publiee]));
  const trimestres = ["T1", "T2", "T3"];
  const publicationsManquantes = classes.flatMap((classe) => trimestres.filter((trimestre) => !publicationMap.get(`${classe.id}:${trimestre}`)).map((trimestre) => ({ classeId: classe.id, classeNom: classe.nom, trimestre })));
  return { annee, classes: classes.length, publicationsAttendues: classes.length * trimestres.length, publicationsValides: classes.length * trimestres.length - publicationsManquantes.length, publicationsManquantes, prete: publicationsManquantes.length === 0 };
}

export async function obtenirEtatCloture(ecoleId: string, anneeScolaireId: string) {
  return verifierEtatCloture(ecoleId, anneeScolaireId);
}

export async function preparerClotureAnnuelle(ecoleId: string, anneeScolaireId: string): Promise<{ etat: EtatCloture; lignes: LigneCloture[] }> {
  const etat = await verifierEtatCloture(ecoleId, anneeScolaireId);
  const classes = await prisma.classe.findMany({ where: { ecoleId, anneeScolaireId }, include: { eleves: true }, orderBy: { nom: "asc" } });
  const lignes: LigneCloture[] = [];
  for (const classe of classes) {
    const cible = ciblePourClasse(classe);
    for (const eleve of classe.eleves) {
      const moyenneAnnuelle = await calculerMoyenneAnnuelle(eleve.id, classe.id);
      const decision: Decision = moyenneAnnuelle !== null && moyenneAnnuelle >= MOYENNE_PASSAGE ? (cible.niveauSuivant ? Decision.PASSE : Decision.DIPLOME) : Decision.REDOUBLE;
      lignes.push({ eleveId: eleve.id, nom: eleve.nom, prenom: eleve.prenom, moyenneAnnuelle, decision, classeId: classe.id, classeNom: classe.nom, niveauSuivant: cible.niveauSuivant, classeCibleNom: decision === Decision.REDOUBLE ? classe.nom : cible.classeCibleNom });
    }
  }
  return { etat, lignes };
}

function libelleAnneeSuivante(libelle: string) {
  const annees = [...libelle.matchAll(/20\d{2}/g)].map((match) => Number(match[0]));
  if (annees.length >= 2) return `${annees[annees.length - 1]}–${annees[annees.length - 1] + 1}`;
  if (annees.length === 1) return `${annees[0] + 1}–${annees[0] + 2}`;
  return `${libelle} — année suivante`;
}

export async function finaliserClotureAnnuelle(ecoleId: string, anneeScolaireId: string, anneeCibleId?: string) {
  const preparation = await preparerClotureAnnuelle(ecoleId, anneeScolaireId);
  if (!preparation.etat.prete) throw new Error(`Clôture bloquée : ${preparation.etat.publicationsManquantes.length} publication(s) manquante(s).`);
  const anneeSource = await prisma.anneeScolaire.findUnique({ where: { id: anneeScolaireId } });
  if (!anneeSource) throw new Error("Année source introuvable.");
  const anneeCible = await prisma.$transaction(async (tx) => {
    let cible = anneeCibleId ? await tx.anneeScolaire.findFirst({ where: { id: anneeCibleId, ecoleId } }) : null;
    if (!cible) cible = await tx.anneeScolaire.findFirst({ where: { ecoleId, libelle: libelleAnneeSuivante(anneeSource.libelle) } });
    if (!cible) cible = await tx.anneeScolaire.create({ data: { ecoleId, libelle: libelleAnneeSuivante(anneeSource.libelle), active: true } });
    await tx.anneeScolaire.updateMany({ where: { ecoleId, id: { not: cible.id } }, data: { active: false } });
    for (const ligne of preparation.lignes) {
      const classeSource = await tx.classe.findUnique({ where: { id: ligne.classeId } });
      if (!classeSource) continue;
      let classeCibleId: string | null = null;
      if (ligne.decision !== Decision.DIPLOME && ligne.classeCibleNom) {
        const cibleClasse = await tx.classe.upsert({
          where: { ecoleId_anneeScolaireId_nom: { ecoleId, anneeScolaireId: cible.id, nom: ligne.classeCibleNom } },
          update: {},
          create: { ecoleId, anneeScolaireId: cible.id, nom: ligne.classeCibleNom, cycle: classeSource.cycle, typeParcours: classeSource.typeParcours, niveauCode: ligne.niveauSuivant ?? classeSource.niveauCode, filiereCode: classeSource.filiereCode },
        });
        classeCibleId = cibleClasse.id;
      }
      await tx.historiqueScolaire.upsert({ where: { eleveId_anneeScolaireId: { eleveId: ligne.eleveId, anneeScolaireId } }, update: { classeNom: ligne.classeNom, moyenneAnnuelle: ligne.moyenneAnnuelle ?? 0, decision: ligne.decision }, create: { eleveId: ligne.eleveId, anneeScolaireId, classeNom: ligne.classeNom, moyenneAnnuelle: ligne.moyenneAnnuelle ?? 0, decision: ligne.decision } });
      await tx.eleve.update({ where: { id: ligne.eleveId }, data: { statut: ligne.decision === Decision.DIPLOME ? StatutEleve.DIPLOME : StatutEleve.ACTIF, classeId: classeCibleId } });
    }
    return cible;
  });
  return { anneeSource, anneeCible, lignes: preparation.lignes, classesCibles: [...new Set(preparation.lignes.map((ligne) => ligne.classeCibleNom).filter(Boolean))] };
}
