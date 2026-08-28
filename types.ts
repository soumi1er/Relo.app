export type Role = "ADMIN" | "PROFESSEUR" | "PARENT" | "ELEVE";
export type Cycle = "PRIMAIRE" | "COLLEGE" | "LYCEE";
export type TypeEtablissement = "FONDAMENTAL" | "LYCEE_GENERAL" | "LYCEE_TECHNIQUE" | "TECHNIQUE_PROFESSIONNEL" | "MIXTE";

export interface Ecole {
  id: string;
  nom: string;
  typeEtablissement: TypeEtablissement;
  adresse?: string | null;
  telephone?: string | null;
  directeurNom?: string | null;
  directeurPrenom?: string | null;
}
export type Trimestre = "T1" | "T2" | "T3";
export type TypeEvaluation = "DEVOIR" | "COMPOSITION";
export type Sexe = "M" | "F";
export type Decision = "PASSE" | "REDOUBLE" | "DIPLOME";

export interface Utilisateur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  ecoleId?: string;
}

export interface AnneeScolaire {
  id: string;
  libelle: string;
  active: boolean;
}

export interface Matiere {
  id: string;
  nom: string;
}

export interface Classe {
  id: string;
  nom: string;
  cycle: Cycle;
  typeParcours?: string | null;
  niveauCode?: string | null;
  filiereCode?: string | null;
  anneeScolaireId: string;
  _count?: { eleves: number };
  matieresClasse?: ClasseMatiere[];
}

export interface ClasseMatiere {
  id: string;
  coefficient: number;
  matiereId: string;
  matiere: Matiere;
}

export interface ClasseDetail extends Classe {
  eleves: Eleve[];
  matieresClasse: ClasseMatiere[];
}

export interface Professeur {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  actif: boolean;
}

export interface Eleve {
  id: string;
  matricule: string | null;
  nom: string;
  prenom: string;
  dateNaissance: string;
  sexe: Sexe;
  statut: string;
  numeroCarte?: string | null;
  carteDelivree?: boolean;
  dateCarte?: string | null;
  classeId: string | null;
  classe?: Classe;
}

export interface MoyenneMatiere {
  matiereId: string;
  matiereNom: string;
  coefficient: number;
  moyenne: number | null;
}

export interface MoyenneEleve {
  moyenneGenerale: number | null;
  detailParMatiere: MoyenneMatiere[];
}

export interface Affectation {
  id: string;
  classeId: string;
  classeMatiereId: string;
  classe: Classe;
  classeMatiere: ClasseMatiere;
}

export interface ResultatPromotion {
  eleveId: string;
  nom: string;
  prenom: string;
  moyenneAnnuelle: number | null;
  decision: Decision;
}
