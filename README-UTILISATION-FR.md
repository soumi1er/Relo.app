# Relo — guide d’installation et de prise en main

Relo est une application de gestion scolaire pensée pour les établissements maliens. L’interface utilise les niveaux et séries du référentiel métier local, notamment la 10ème, la 11ème et la 12ème, sans afficher les appellations « Seconde », « Première » ou « Terminale ».

## Installation Windows avec Tauri

Pour l’utilisateur final, l’installateur Tauri `.exe` est le parcours recommandé. Il installe la fenêtre native Relo, le frontend, le backend local et le runtime Node embarqué. **Node.js, Rust et Electron ne sont pas nécessaires pour utiliser l’application installée.** Tauri s’appuie sur WebView2, généralement déjà présent sur Windows ou installé par le bootstrapper Microsoft.

Le fichier source Windows permet de reconstruire l’installateur :

1. Décompressez l’archive dans un dossier local, par exemple `C:\Relo`.
2. Pour une installation prête à l’emploi, lancez l’installateur `.exe` produit depuis un environnement Windows.
3. Pour reconstruire depuis les sources, installez Node.js 20 ou plus récent, Rust stable, WebView2 et les Microsoft C++ Build Tools.
4. Depuis `desktop`, lancez `npm install`, puis `npm run tauri:build`.
5. L’installateur NSIS apparaît dans `desktop/src-tauri/target/release/bundle/nsis/`.

Le backend empaqueté ne dépend pas d’un `.env` inclus dans le programme. Tauri crée une base SQLite persistante dans le dossier de données utilisateur de Relo. Les secrets et la base de développement ne sont pas distribués dans l’archive source.

## Première configuration

Lors de la première utilisation, créez le compte administrateur et le nom de l’établissement. Après la création du compte, Relo ouvre une étape séparée pour choisir le type d’établissement : fondamental, lycée général, lycée technique, technique professionnel ou mixte. Ce choix filtre les parcours proposés dans **Classes & parcours**.

Relo ne crée pas douze classes fictives. Dans **Classes & parcours**, l’administration sélectionne l’année scolaire, le parcours, le niveau malien puis la série ou filière avant de créer uniquement les classes réellement ouvertes. Les séries enregistrées dans la fiche d’un élève sont cohérentes avec les classes disponibles.

## Élèves et import documentaire

L’import accepte les PDF textuels ou scannés, les images, les fichiers Word, Excel, CSV et texte. La lecture locale reconstruit les colonnes lorsque cela est possible. Si une clé OpenAI est configurée côté serveur, Relo IA peut analyser les PDF scannés, images et tableaux complexes. Une classe peut être détectée dans un titre, un en-tête, au-dessus d’un tableau ou dans une colonne.

Avant l’enregistrement, toutes les lignes restent visibles et modifiables dans Relo. L’administration peut corriger le nom, le prénom, la date, le sexe, la classe et le matricule. Les classes absentes sont proposées pour création avant validation. La fiche élève permet ensuite de modifier directement la classe et la filière ; aucun export Excel n’est nécessaire pour effectuer ces corrections.

## Relo IA

La page **Relo IA** comporte une lecture des données réelles de l’établissement, des signaux navigables et un assistant conversationnel. Le chat reçoit uniquement un contexte limité : effectifs, classes, séries, présence de notes et dossiers incomplets. Il ne déclenche pas d’action destructive et les décisions scolaires restent validées par l’équipe éducative.

Sans clé OpenAI, le chat conserve une réponse locale utile basée sur les statistiques disponibles. Avec une clé valide, il propose des réponses plus riches en français. Configurez la clé exclusivement dans `backend/.env` en développement ou dans la configuration locale prévue à cet effet :

```env
OPENAI_API_KEY="votre_nouvelle_cle"
OPENAI_API_BASE="https://api.openai.com/v1"
OPENAI_MODEL="gpt-5-mini"
PDF_IMPORT_USE_IA="true"
PDF_MAX_BODY="50mb"
```

La clé qui a été partagée précédemment dans la conversation doit être considérée comme compromise : **révoquez-la et remplacez-la avant toute utilisation**. Ne l’insérez jamais dans le frontend, dans Git ou dans une archive.

## Données et sécurité locale

Les comptes mémorisés sur un ordinateur conservent seulement l’email, le nom, le prénom, le rôle et la dernière connexion. Les mots de passe et tokens ne sont pas sauvegardés. En production Tauri, la base SQLite est stockée dans le dossier de données utilisateur de l’application et non dans le dossier des ressources installées.

## Commandes de développement

Dans `backend`, utilisez `npm run build` pour compiler le serveur. Dans `desktop`, utilisez `npm run build` pour compiler le frontend et vérifier les anciens fichiers Electron. Utilisez `npm run tauri:dev` pour lancer la fenêtre Tauri en développement et `npm run tauri:build` pour créer les paquets natifs. La commande `electron:build` est conservée temporairement comme voie de comparaison et de repli.

## Références techniques

La configuration suit le modèle officiel d’intégration Tauri 2 + Vite : [`frontendDist`, `devUrl` et hooks Vite](https://v2.tauri.app/start/frontend/vite/). Les ressources backend sont mappées vers des chemins stables dans le bundle conformément à la documentation Tauri sur l’[embedding de ressources](https://v2.tauri.app/develop/resources/). Le runtime Node embarqué suit le principe de [sidecar Node.js](https://v2.tauri.app/learn/sidecar-nodejs/).

## Importer des élèves sans matricule

Le champ matricule est facultatif. Après l’analyse d’un document, les cellules vides peuvent rester vides, notamment pour les classes fondamentales. Au moment de l’import, Relo demande une confirmation explicite si une ou plusieurs lignes complètes n’ont pas de matricule. Si l’utilisateur confirme, la valeur est enregistrée comme absente et aucun matricule fictif n’est généré. La fiche élève permet ensuite d’ajouter ou de retirer le matricule.

## Scolarité et paiements

La rubrique **Scolarité** permet de définir le montant annuel et une éventuelle remise pour chaque élève, puis d’enregistrer les paiements par espèces, Orange Money, Moov Money, virement, chèque ou autre mode. Relo calcule le montant net, le total encaissé, le reste à payer et l’état du dossier : à payer, partiel ou soldé.

## Cartes d’élèves

La rubrique **Cartes élèves** émet un numéro de carte stable, affiche une prévisualisation et ouvre l’impression directement depuis Relo. Une carte peut être marquée comme non délivrée pour corriger une situation. L’absence de matricule ne bloque pas la carte : son numéro de carte est distinct de l’identifiant scolaire.

## Clôture et nouvelles listes

Dans **Passage scolaire**, sélectionnez l’année à clôturer puis utilisez **Préparer la clôture**. Relo vérifie que les publications T1, T2 et T3 de toutes les classes existent. Si une publication manque, la finalisation est bloquée et les classes concernées sont listées.

Lorsque toutes les publications sont validées, Relo affiche un aperçu global : élèves examinés, passants, redoublants, diplômés et classe cible. Le bouton **Finaliser et créer les nouvelles listes** demande une confirmation, enregistre les décisions annuelles, crée ou réutilise l’année suivante et affecte les passants aux niveaux supérieurs selon les codes maliens. Les redoublants restent dans une classe de même niveau. Cette opération ne s’exécute jamais silencieusement.

## Tester toute l’application avec Docker Compose

Le fichier `docker-compose.yml` à la racine démarre trois services : PostgreSQL sur `localhost:5433`, l’API Express sur `http://localhost:4000` et l’interface web sur `http://localhost:8080`. Le backend utilise une variante Prisma PostgreSQL dédiée au conteneur ; le runtime Tauri et le schéma SQLite de bureau restent inchangés.

Depuis la racine du projet :

```bash
docker compose up --build
```

Ouvrez ensuite `http://localhost:8080`. Le premier démarrage peut prendre quelques minutes : PostgreSQL devient sain, Prisma applique le schéma, puis l’API et Nginx démarrent. Pour arrêter les services sans supprimer les données de test :

```bash
docker compose down
```

Pour réinitialiser complètement la base locale Docker :

```bash
docker compose down -v
```

La clé OpenAI n’est volontairement pas inscrite dans `docker-compose.yml`. Pour tester Relo IA ponctuellement, créez un fichier `.env.docker.local` non versionné contenant `OPENAI_API_KEY=...`, décommentez l’environnement correspondant dans Compose ou injectez la variable dans le service backend selon votre configuration Docker. Ne publiez jamais ce fichier sur GitHub.

La configuration Compose est une base de test local proche de la production. Elle n’est pas une configuration de production : il faut remplacer les mots de passe de démonstration, utiliser des secrets Docker ou ceux de la plateforme d’hébergement, configurer HTTPS et effectuer des sauvegardes PostgreSQL avant toute mise en ligne.
