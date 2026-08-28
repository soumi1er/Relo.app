# Mettre Relo sur GitHub — guide simple

## Ce que vous devez faire maintenant

Le dépôt `https://github.com/soumi1er/Relo.app` existe, mais il ne contient pas encore le code complet de Relo. Les fichiers de travail fournis avec ce guide contiennent deux workflows à placer exactement dans le dépôt :

```text
.github/workflows/ci.yml
.github/workflows/deploy-frontend.yml
```

Le premier vérifie le code. Le second construit et publie uniquement l’interface React/Vite sur GitHub Pages.

## Étape 1 — Envoyer le code Relo

Dans GitHub, ouvrez le dépôt `soumi1er/Relo.app`, cliquez sur **Add file**, puis **Upload files**. Envoyez le contenu du projet en conservant notamment les dossiers `backend`, `desktop`, `prisma` et les scripts Docker.

Ne téléversez jamais les éléments suivants :

```text
backend/.env
backend/data/
*.db
node_modules/
desktop/src-tauri/target/
```

La clé OpenAI doit rester uniquement dans les variables secrètes de l’environnement backend. Elle ne doit jamais être placée dans le frontend ou dans un commit GitHub.

## Étape 2 — Ajouter les workflows

Créez le dossier `.github/workflows` à la racine du dépôt, puis placez-y les deux fichiers fournis :

```text
ci.yml
 deploy-frontend.yml
```

Retirez l’espace initial devant `deploy-frontend.yml` dans l’exemple ci-dessus : il s’agit bien du nom exact `deploy-frontend.yml`.

Commitez les fichiers sur la branche `main`. Le workflow **Relo CI** doit apparaître dans l’onglet **Actions**. Il validera Prisma et compilera le backend et le frontend.

## Étape 3 — Activer GitHub Pages

Dans le dépôt GitHub :

1. Ouvrez **Settings**.
2. Ouvrez **Pages** dans la section **Code, planning, and automation**.
3. Dans **Build and deployment**, sélectionnez **GitHub Actions**.
4. Retournez dans **Actions** et vérifiez le workflow **Relo — déploiement frontend**.
5. Après un commit sur `main`, GitHub affichera l’URL publiée dans l’environnement `github-pages`.

Si le dépôt reste public, l’URL ressemblera à :

```text
https://soumi1er.github.io/Relo.app/
```

## Étape 4 — Configurer l’URL de l’API

GitHub Pages ne peut pas faire fonctionner Express. Il faut donc déployer le backend sur Render, Railway ou un serveur équivalent.

Dans GitHub, ouvrez **Settings → Environments**, sélectionnez ou créez `github-pages`, puis ajoutez la variable :

```text
VITE_API_URL=https://votre-api.example.com/api
```

L’URL doit être publique, utiliser HTTPS et pointer vers le backend Relo. Il ne faut jamais utiliser `localhost` dans cette variable en production.

## Étape 5 — Vérifier le routage Vite

Le projet utilise une base relative et un routeur compatible avec l’hébergement statique. Après publication, vérifiez :

- l’ouverture de la page de connexion ;
- le chargement des logos et des assets ;
- l’appel de `https://votre-api.example.com/api/sante` ;
- la connexion avec un compte de démonstration ;
- les droits professeur et administrateur.

## Important : ce que ces workflows ne font pas encore

Ces workflows automatisent la validation du code et la publication du frontend. Ils ne déploient pas encore automatiquement le backend Express ni PostgreSQL, car ces deux composants nécessitent un fournisseur d’hébergement et des secrets de production.

Pour la version complète en ligne, il faudra ensuite :

```text
GitHub → code et CI/CD
GitHub Pages → frontend React
Render/Railway → backend Express
Supabase/Neon/Railway → PostgreSQL
```

Le fichier `docker-compose.yml` reste utile pour tester les trois composants sur votre ordinateur avant de les envoyer en production.
