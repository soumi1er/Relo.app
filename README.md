# Relo — Backend (Étape 1/3)

API centrale du système de gestion scolaire Relo : élèves, classes, notes,
bulletins, passage/redoublement automatique. C'est le socle sur lequel se
connecteront ensuite l'application de bureau (admin + professeurs) et le
portail web de consultation (élèves/parents).

## Technologies utilisées

- Node.js + TypeScript
- Express (API REST)
- PostgreSQL + Prisma (base de données et ORM)
- JWT (authentification) + bcryptjs (hachage des mots de passe)
- Zod (validation des données entrantes)
- PDFKit (génération des bulletins en PDF)

## 1. Installer les outils nécessaires

- [Node.js](https://nodejs.org/) version 20 ou supérieure
- [PostgreSQL](https://www.postgresql.org/download/) version 14 ou supérieure (local ou distant)

Vérifiez les installations :
```bash
node -v
npm -v
psql --version
```

## 2. Installer les dépendances du projet

```bash
cd relo-backend
npm install
```

## 3. Configurer les variables d'environnement

Copiez le fichier d'exemple et remplissez vos propres valeurs :
```bash
cp .env.example .env
```

Dans `.env`, remplacez notamment :
- `DATABASE_URL` : les identifiants de votre base PostgreSQL
- `JWT_SECRET` : une chaîne aléatoire longue et secrète (jamais la valeur d'exemple)

## 4. Créer la base de données

Créez une base PostgreSQL vide (nom au choix, doit correspondre à `DATABASE_URL`) :
```bash
createdb relo_db
```

Puis appliquez le schéma :
```bash
npx prisma migrate dev --name init
```

Cette commande crée toutes les tables (écoles, utilisateurs, classes, élèves,
notes, etc.) et génère le client Prisma utilisé par le code.

## 5. Lancer le serveur en développement

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:4000`. Vérifiez qu'il répond :
```bash
curl http://localhost:4000/api/sante
# {"statut":"ok"}
```

## 6. Construire la version finale (production)

```bash
npm run build
npm start
```

`npm run build` compile le TypeScript vers `dist/`. `npm start` lance la
version compilée — c'est celle-ci qu'il faut utiliser sur un serveur de
production, pas `npm run dev`.

## Premiers pas avec l'API

### Créer une école (et son premier compte administrateur)
```bash
curl -X POST http://localhost:4000/api/ecoles/inscription \
  -H "Content-Type: application/json" \
  -d '{
    "nomEcole": "Lycée Exemple",
    "adminNom": "Traoré",
    "adminPrenom": "Aïssata",
    "adminEmail": "admin@lycee-exemple.ml",
    "adminMotDePasse": "MotDePasseSolide123"
  }'
```

### Se connecter
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@lycee-exemple.ml", "motDePasse": "MotDePasseSolide123"}'
```
La réponse contient un `token` à utiliser dans l'en-tête
`Authorization: Bearer <token>` pour toutes les autres routes.

### Flux typique pour démarrer une école
1. `POST /api/ecoles/inscription` — créer l'école + le compte admin
2. `POST /api/auth/login` — se connecter en tant qu'admin
3. `POST /api/annees` — créer l'année scolaire en cours (ex. "2025-2026")
4. `POST /api/matieres` — créer les matières
5. `POST /api/classes` — créer les classes
6. `POST /api/classes/:id/matieres` — définir le coefficient de chaque matière par classe
7. `POST /api/professeurs` — créer les comptes professeurs
8. `POST /api/professeurs/affectations` — affecter chaque professeur à ses classes/matières
9. `POST /api/eleves/inscription` — inscrire les élèves
10. `POST /api/notes` — les professeurs saisissent les notes (uniquement pour leurs classes/matières)
11. `GET /api/bulletins/:eleveId?trimestre=T1` — télécharger un bulletin PDF
12. `POST /api/promotion/calculer` — en fin d'année, calculer passages/redoublements pour une classe

## Rôles et permissions

| Rôle | Permissions |
|---|---|
| `ADMIN` | Accès complet : écoles, classes, matières, professeurs, élèves, notes, bulletins, promotions |
| `PROFESSEUR` | Peut saisir/modifier des notes **uniquement** pour les classes/matières où il est affecté |
| `PARENT` | Consultation seule des élèves qui lui sont liés (dossier, notes, bulletins) |
| `ELEVE` | Consultation seule de son propre dossier, notes et bulletins |

Ce contrôle est appliqué **côté serveur** dans chaque route (jamais seulement
côté interface), pour empêcher tout contournement.

## Créer un exécutable/installateur à partager

Cette étape backend est un service qui tourne en continu (pas un exécutable à
distribuer) — il doit être installé une fois sur le serveur de l'école (ou un
hébergement cloud). L'application de bureau (étape suivante) sera, elle,
empaquetée en `.exe` avec Electron Builder pour être installée sur les postes
des professeurs et de l'administration.

## Identifiants à remplacer avant mise en production

- `JWT_SECRET` dans `.env`
- Le mot de passe du premier compte admin (à changer après la première connexion)
- `DATABASE_URL` avec les vrais identifiants PostgreSQL du serveur de production

## Ce qui est implémenté à cette étape

- Authentification sécurisée (JWT + mots de passe hachés bcrypt)
- Multi-établissement (chaque école a ses données isolées)
- Gestion des années scolaires, classes, matières, coefficients
- Gestion des professeurs et de leurs affectations
- Inscription des élèves (avec matricule automatique) dès leur arrivée
- Saisie des notes avec contrôle strict des permissions par rôle
- Calcul automatique des moyennes (par matière, générale, annuelle)
- Génération de bulletins PDF
- Calcul automatique des passages/redoublements selon la moyenne annuelle

## Prochaines étapes (à venir)

- Application de bureau (Electron) pour l'administration et les professeurs
- Portail web de consultation pour les élèves et parents
- Statistiques de classe, gestion des absences (fonctionnalités secondaires)

## Note technique sur la vérification de ce code

Ce code a été rédigé et relu attentivement, mais dans mon environnement de
développement je n'ai pas pu exécuter `prisma generate` (le téléchargement du
moteur Prisma est bloqué par les restrictions réseau de mon bac à sable).
Sur votre machine, avec un accès internet normal, l'étape 4 ci-dessus
fonctionnera sans problème. Si une erreur apparaît malgré tout au premier
lancement, montrez-la-moi et je la corrige immédiatement.
