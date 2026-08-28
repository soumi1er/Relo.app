import { Trimestre } from "../types/enums";
import { prisma } from "../lib/prisma";

export interface MoyenneMatiere {
  matiereId: string;
  matiereNom: string;
  coefficient: number;
  moyenne: number | null; // null si aucune note saisie
}

export interface MoyenneEleve {
  moyenneGenerale: number | null;
  detailParMatiere: MoyenneMatiere[];
}

/**
 * Calcule la moyenne d'un élève dans une classe pour un trimestre donné.
 * Ramène chaque note sur 20, fait la moyenne simple des notes d'une matière,
 * puis pondère par le coefficient de la matière pour la moyenne générale.
 * Les matières sans aucune note ne comptent pas dans le calcul (pour éviter
 * de pénaliser injustement un élève avant que toutes les notes soient saisies).
 */
export async function calculerMoyenneEleve(
  eleveId: string,
  classeId: string,
  trimestre: Trimestre
): Promise<MoyenneEleve> {
  const classeMatieres = await prisma.classeMatiere.findMany({
    where: { classeId },
    include: {
      matiere: true,
      notes: { where: { eleveId, trimestre } },
    },
  });

  const detailParMatiere: MoyenneMatiere[] = classeMatieres.map((cm) => {
    if (cm.notes.length === 0) {
      return {
        matiereId: cm.matiereId,
        matiereNom: cm.matiere.nom,
        coefficient: cm.coefficient,
        moyenne: null,
      };
    }

    const totalSur20 = cm.notes.reduce((somme, note) => somme + (note.valeur / note.bareme) * 20, 0);
    const moyenneMatiere = totalSur20 / cm.notes.length;

    return {
      matiereId: cm.matiereId,
      matiereNom: cm.matiere.nom,
      coefficient: cm.coefficient,
      moyenne: Math.round(moyenneMatiere * 100) / 100,
    };
  });

  const matieresNotees = detailParMatiere.filter((m) => m.moyenne !== null) as (MoyenneMatiere & {
    moyenne: number;
  })[];

  if (matieresNotees.length === 0) {
    return { moyenneGenerale: null, detailParMatiere };
  }

  const sommeCoefficients = matieresNotees.reduce((s, m) => s + m.coefficient, 0);
  const sommePonderee = matieresNotees.reduce((s, m) => s + m.moyenne * m.coefficient, 0);
  const moyenneGenerale = sommeCoefficients > 0 ? sommePonderee / sommeCoefficients : null;

  return {
    moyenneGenerale: moyenneGenerale !== null ? Math.round(moyenneGenerale * 100) / 100 : null,
    detailParMatiere,
  };
}

/**
 * Calcule la moyenne annuelle d'un élève à partir de la moyenne des 3 trimestres.
 * Les trimestres sans aucune moyenne calculable sont ignorés.
 */
export async function calculerMoyenneAnnuelle(
  eleveId: string,
  classeId: string
): Promise<number | null> {
  const trimestres: Trimestre[] = [Trimestre.T1, Trimestre.T2, Trimestre.T3];

  const moyennes = await Promise.all(
    trimestres.map((t) => calculerMoyenneEleve(eleveId, classeId, t))
  );

  const valeurs = moyennes
    .map((m) => m.moyenneGenerale)
    .filter((m): m is number => m !== null);

  if (valeurs.length === 0) return null;

  const moyenneAnnuelle = valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
  return Math.round(moyenneAnnuelle * 100) / 100;
}

export interface ClassementEleve {
  eleveId: string;
  nom: string;
  prenom: string;
  moyenne: number | null;
  rang: number | null;
}

export async function calculerClassement(classeId: string, trimestre: Trimestre): Promise<ClassementEleve[]> {
  const classe = await prisma.classe.findUnique({ where: { id: classeId }, include: { eleves: true } });
  if (!classe) return [];
  const resultats = await Promise.all(classe.eleves.map(async (e) => ({
    eleveId: e.id, nom: e.nom, prenom: e.prenom,
    moyenne: (await calculerMoyenneEleve(e.id, classeId, trimestre)).moyenneGenerale,
    rang: null as number | null,
  })));
  resultats.sort((a, b) => {
    if (a.moyenne === null && b.moyenne === null) return a.nom.localeCompare(b.nom);
    if (a.moyenne === null) return 1;
    if (b.moyenne === null) return -1;
    return b.moyenne - a.moyenne;
  });
  let rang = 0; let precedent: number | null = null;
  resultats.forEach((r, i) => {
    if (r.moyenne === null) { r.rang = null; return; }
    if (precedent === null || r.moyenne !== precedent) rang = i + 1;
    r.rang = rang; precedent = r.moyenne;
  });
  return resultats;
}
