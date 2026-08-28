# Relo — version refondue

Cette version conserve le cœur métier de Relo — gestion des élèves, classes, matières, professeurs, notes, bulletins et décisions scolaires — mais reconstruit entièrement l’expérience autour d’un cockpit plus lisible, plus chaleureux et plus intelligent.

## Ce qui change

L’identité visuelle adopte un univers bleu nuit, sable clair, corail, turquoise et violet. La navigation latérale est contextualisée par rôle et donne un accès permanent à Relo IA. Le tableau de bord présente les priorités du jour, les métriques utiles, la progression de l’année et des raccourcis d’action. L’écran de connexion a été repensé en deux colonnes avec une présentation claire du positionnement de Relo.

La page « Classes & parcours » dépend maintenant du type d’établissement déclaré par l’administration : établissement fondamental, lycée d’enseignement général, lycée technique, centre technique et professionnel ou établissement mixte. Relo ne génère plus douze classes par défaut et ne montre plus les anciennes appellations « Première », « Seconde » et « Terminale ». L’administration choisit uniquement les classes réellement ouvertes : 1ère à 9ème année du fondamental, 10ème, 11ème et 12ème du lycée, puis les filières Lettres, Sciences, SES, TLL, TAL, TSS, TSECO, TSEXP, TSE, GM, GC, GMI, GELN, GEN, GEL, CF et GCO selon le type choisi. Chaque classe conserve son niveau, son parcours et sa filière en base.

Relo IA est devenu une couche de travail. L’écran dédié restitue des signaux prioritaires, des recommandations, des modules d’aide à l’import, au suivi et à la révision, ainsi qu’une explication du rôle de l’IA. Le backend ajoute une route authentifiée `/api/ia/insights`. Si `OPENAI_API_KEY` est configurée, Relo IA peut appeler un modèle OpenAI-compatible configurable ; sans clé, un moteur local de secours fournit des recommandations déterministes à partir des données de l’établissement. Les secrets ne sont jamais exposés au frontend.

L’import PDF dispose désormais d’une double lecture. Il commence par une reconstruction locale des colonnes, puis envoie le PDF complet au moteur IA distant lorsqu’une clé est configurée. Cette seconde passe permet de traiter les documents scannés et les tableaux difficiles. Le résultat reste une prévisualisation contrôlée : l’administration peut modifier chaque nom, prénom, classe, date, sexe et matricule avant l’écriture. Les matricules présents dans le PDF sont conservés ; un matricule vide est généré automatiquement. Les classes absentes détectées dans le PDF sont proposées dans une zone dédiée, puis créées et rattachées en une action.

## Lancer le projet en développement

Dans `backend`, installer les dépendances puis lancer `npm run dev`. Dans `desktop`, installer les dépendances puis lancer `npm run dev`. L’adresse du backend peut être changée depuis « Paramètres du serveur » dans l’écran de connexion ; la valeur attendue se termine par `/api`.

Pour construire le logiciel de bureau, exécuter `npm run electron:build` dans `desktop`. La version Linux produite est l’AppImage fournie séparément dans la livraison. Les scripts Windows de l’archive originale sont conservés.

## Configuration IA facultative

Copier les paramètres de `.env.example` dans l’environnement du backend. `OPENAI_API_BASE` peut pointer vers un endpoint OpenAI-compatible. Le modèle par défaut est `gpt-5-mini`, choisi pour sa rapidité et son coût adapté à des analyses contextuelles fréquentes. La couche locale de secours reste active si la clé est absente, invalide ou temporairement indisponible. `PDF_MAX_BODY` règle la taille maximale du PDF encodé en base64 et `PDF_IMPORT_USE_IA=false` force le mode local.

## Documents associés

`REFONTE-DESIGN.md` présente la direction artistique et les principes de produit. `recherche-filières-mali.md` conserve les sources et le référentiel scolaire retenu. `VERIFICATION-VISUELLE.md` résume les compilations et la vérification de l’écran de connexion.
