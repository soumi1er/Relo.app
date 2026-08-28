# Relo — direction de refonte

## Positionnement

Relo devient un cockpit scolaire calme, lumineux et intelligent pour les établissements maliens. L’application doit donner une impression de maîtrise immédiate : une information importante est lisible en moins de trois secondes, une action fréquente en moins de deux clics, et chaque page indique clairement le prochain geste utile.

## Direction visuelle

La palette quitte le vert administratif uniforme pour un contraste plus éditorial : bleu nuit profond pour la structure, sable chaud pour les surfaces, corail solaire pour les actions, turquoise pour les états positifs et violet électrique pour les fonctions de Relo IA. Cette combinaison évoque la confiance, la chaleur et l’énergie numérique sans devenir décorative. Les cartes ont des rayons généreux, des ombres très légères et des bordures translucides. Les animations restent courtes et fonctionnelles : apparition progressive des blocs, élévation au survol, halo discret autour de Relo IA, et transitions d’état de 160 à 240 ms.

## Navigation

La barre latérale est organisée en trois zones : identité et contexte de l’établissement, navigation métier, puis raccourci vers Relo IA et profil. Le contenu principal adopte une largeur confortable, un bandeau d’accueil et des cartes denses mais respirantes. Sur petit écran, la navigation devient une barre horizontale scrollable.

## Parcours des classes

La création et le filtrage suivent une hiérarchie explicite : type d’enseignement (Lycée général ou Lycée technique), niveau (10ème, 11ème, Terminale/12ème), puis série/filière. Pour le général, les séries sont préchargées avec libellé long et acronyme : 11ème Lettres, 11ème Sciences, 11ème SES ; TLL, TAL, TSS, TSECO, TSExp/TEXP et TSE. Pour le technique, les familles observées sont GM, GC, GMI, GELN, GEN, GEL, CF et GCO. Les intitulés restent modifiables par établissement.

## Relo IA : une couche de travail

Relo IA ne se limite pas à une conversation. Il intervient dans le tableau de bord, les listes et les formulaires via des recommandations contextuelles : résumé de situation, détection de classes incomplètes, priorisation des élèves à accompagner, aide à l’import PDF, explication des variations de moyenne, génération d’un plan de révision et aide à la préparation d’une publication. Un panneau latéral « IA active » présente les décisions proposées, la raison, le niveau de confiance et l’action suivante. Une route backend optionnelle permet de générer ces recommandations avec un modèle configurable ; sans clé IA, un moteur local de secours conserve une expérience utile et prévisible.
