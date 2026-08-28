// Extraction de texte PDF respectant la mise en page réelle du document.
//
// PROBLÈME RÉSOLU PAR CE FICHIER :
// pdf-parse, utilisé en mode par défaut, restitue le texte dans l'ordre où
// il est enregistré à l'intérieur du fichier PDF — pas forcément dans
// l'ordre visuel de lecture. Pour un tableau (liste d'élèves avec colonnes
// Nom / Prénom / Classe / Date de naissance / Sexe), certains générateurs de
// PDF (Word, Excel, LibreOffice, d'autres logiciels de gestion scolaire...)
// écrivent le contenu cellule par cellule plutôt que ligne par ligne. On se
// retrouve alors, une fois le texte extrait, avec quelque chose comme :
//
//   NOM
//   PRÉNOM
//   CLASSE
//   DIARRA
//   Aminata
//   6ème A
//   ...
//
// au lieu d'une ligne par élève. C'est ce qui provoquait le mélange des
// informations : le nom d'un élève pouvait se retrouver associé à la classe
// d'un autre, la date de naissance disparaissait complètement, etc.
//
// SOLUTION : on reconstruit nous-mêmes les lignes à partir de la position
// (x, y) de chaque fragment de texte sur la page — exactement ce que fait
// la commande `pdftotext -layout`. Les fragments qui partagent la même
// hauteur sur la page forment une ligne visuelle ; on les trie ensuite de
// gauche à droite. Un grand espace horizontal entre deux fragments indique
// un changement de colonne (bordure de cellule) plutôt qu'un simple espace
// entre deux mots d'une même cellule (ex. "1ère" / "année") : on insère
// alors un séparateur explicite "  |  " que le reste du code peut détecter
// de façon fiable, quel que soit le logiciel qui a produit le PDF.

import pdfParse from "pdf-parse";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

interface FragmentTexte {
  texte: string;
  x: number;
  y: number;
}

// Deux fragments dont la position verticale diffère de moins de cette
// valeur (en points PDF) sont considérés comme appartenant à la même ligne.
const TOLERANCE_MEME_LIGNE = 3;

// Un espace horizontal supérieur à cette valeur (en points PDF) entre deux
// fragments consécutifs d'une même ligne est interprété comme un changement
// de colonne. En pratique, l'espacement entre deux mots d'une même cellule
// dépasse rarement quelques points, tandis que le rembourrage / centrage
// d'une colonne de tableau se compte en dizaines de points.
const SEUIL_CHANGEMENT_COLONNE = 14;

export const SEPARATEUR_COLONNE = "  |  ";

function construireLigne(fragmentsLigne: FragmentTexte[]): string {
  const tries = [...fragmentsLigne].sort((a, b) => a.x - b.x);
  let ligne = tries[0].texte;
  for (let i = 1; i < tries.length; i++) {
    const espace = tries[i].x - tries[i - 1].x;
    ligne += espace > SEUIL_CHANGEMENT_COLONNE ? SEPARATEUR_COLONNE : " ";
    ligne += tries[i].texte;
  }
  return ligne;
}

function reconstituerTextePage(fragments: FragmentTexte[]): string {
  if (fragments.length === 0) return "";

  // Tri principal par hauteur décroissante (haut de page en premier, comme
  // une lecture normale), puis par position horizontale.
  const tries = [...fragments].sort((a, b) => b.y - a.y || a.x - b.x);

  const lignes: FragmentTexte[][] = [];
  for (const fragment of tries) {
    const derniereLigne = lignes[lignes.length - 1];
    if (derniereLigne && Math.abs(derniereLigne[0].y - fragment.y) <= TOLERANCE_MEME_LIGNE) {
      derniereLigne.push(fragment);
    } else {
      lignes.push([fragment]);
    }
  }

  return lignes.map(construireLigne).join("\n");
}

/**
 * Extrait le texte d'un PDF en reconstruisant l'ordre visuel des colonnes,
 * pour que chaque ligne du texte obtenu corresponde bien à une ligne du
 * tableau d'origine (un élève par ligne), quel que soit le logiciel qui a
 * généré le fichier.
 */
export async function extraireTexteAvecMiseEnPage(tampon: Buffer): Promise<string> {
  try {
    const document = await pdfParse(tampon, {
      pagerender: async (pageData: any) => {
        const contenu = await pageData.getTextContent();
        const fragments: FragmentTexte[] = contenu.items
          .map((item: any) => ({ texte: String(item.str ?? ""), x: item.transform[4] as number, y: item.transform[5] as number }))
          .filter((f: FragmentTexte) => f.texte.trim().length > 0);
        return reconstituerTextePage(fragments);
      },
    });
    return document.text;
  } catch (erreurPdfParse) {
    // Certains PDF produits par Word, Excel ou des imprimantes virtuelles
    // contiennent une table XRef que l’ancien pdf-parse refuse. pdftotext
    // devient alors un secours fiable pour reconstruire l’ordre visuel.
    const dossier = await mkdtemp(join(tmpdir(), "relo-pdf-"));
    const entree = join(dossier, "document.pdf");
    try {
      await writeFile(entree, tampon);
      const resultat = await execFileAsync(process.platform === "win32" ? "pdftotext.exe" : "pdftotext", ["-layout", entree, "-"], { maxBuffer: 30 * 1024 * 1024 });
      if (resultat.stdout?.trim()) return resultat.stdout;
    } catch {
      // Si pdftotext n’est pas installé, l’appelant peut encore déléguer le
      // document complet à Relo IA pour une lecture haute précision.
    } finally {
      await rm(dossier, { recursive: true, force: true });
    }
    throw erreurPdfParse;
  }
}
