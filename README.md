# Relo Desktop — Tauri + React

Relo Desktop utilise désormais **Tauri 2** comme runtime natif. Le frontend reste une application React + TypeScript servie par Vite. Le backend Express + Prisma + SQLite est conservé et lancé comme processus Node local par Tauri afin de préserver les routes, l’authentification, les imports et le chat Relo IA.

## Architecture

| Couche | Technologie | Rôle |
|---|---|---|
| Fenêtre native | Tauri 2 / Rust | Fenêtre desktop, ressources, cycle de vie et arrêt propre du backend. |
| Interface | React 18 + TypeScript + Vite | Navigation, formulaires, tableaux et workflows métier. |
| Design | Tailwind CSS + primitives UI locales de style shadcn/ui | Tokens de couleur, composants réutilisables et cohérence visuelle. |
| Animation | Motion | Transitions fluides des écrans et états d’onboarding. |
| Icônes | Lucide React | Iconographie homogène. |
| Serveur local | Node.js + Express | API Relo, authentification, IA, imports et règles métier. |
| Données | Prisma + SQLite | Base locale persistante par installation. |

## Pré-requis de développement

Pour le frontend, Node.js 20 ou supérieur est recommandé. Pour compiler Tauri localement sous Linux, installez Rust stable, WebKitGTK 4.1, GTK et les dépendances système indiquées dans la documentation [Tauri](https://v2.tauri.app/start/prerequisites/). Sous Windows, Tauri utilise WebView2 et les Microsoft C++ Build Tools ; l’utilisateur final n’a pas besoin d’installer Rust.

Le backend doit être compilé avant le lancement Tauri :

```bash
cd ../backend
npm install
npm run build
```

## Développement Tauri

Depuis le dossier `desktop` :

```bash
npm install
npm run tauri:dev
```

La commande lance Vite sur `http://localhost:5173`, puis ouvre la fenêtre Tauri. En mode debug, Rust démarre le serveur Node à partir de `../../backend` et utilise le dossier `backend/data` pour SQLite.

Le frontend continue de communiquer avec `http://localhost:4000/api`. Les routes Express existantes restent inchangées, notamment `/api/ia/insights`, `/api/ia/chat`, `/api/eleves/importer/analyser` et les routes de gestion scolaire.

## Build Tauri

```bash
npm run tauri:build
```

Avant la compilation, `tauri:prepare-runtime` copie le runtime Node de la machine dans `src-tauri/bundled-node/`. Le runtime est ensuite inclus dans le paquet avec le backend compilé et ses dépendances. En production, Tauri place la base SQLite dans le dossier de données utilisateur de l’application, au lieu de dépendre d’un `.env` embarqué.

La compilation Linux produit les artefacts dans :

```text
src-tauri/target/release/bundle/
```

Sous Windows, lancez la même commande dans un environnement Windows équipé de WebView2 et des Build Tools pour produire l’installateur `.exe` NSIS. Le script `prepare-tauri-runtime` sélectionne automatiquement `node.exe` sous Windows.

## Configuration IA

La clé OpenAI reste strictement côté backend. Configurez-la dans `backend/.env` sur la machine de développement ou dans la configuration locale de l’installation :

```env
OPENAI_API_KEY="votre_nouvelle_cle"
OPENAI_API_BASE="https://api.openai.com/v1"
OPENAI_MODEL="gpt-5-mini"
PDF_IMPORT_USE_IA="true"
```

Le frontend Tauri ne reçoit jamais cette clé. Le chat utilise un contexte limité de l’établissement et le backend dispose d’un mode local de secours lorsque l’API distante est absente ou indisponible.

## Compatibilité Electron

Les fichiers Electron historiques et la commande `electron:build` sont conservés temporairement comme voie de repli pendant la phase de comparaison. Le chemin recommandé pour la nouvelle application est désormais `tauri:dev` et `tauri:build`. Ils pourront être retirés après validation de l’installateur Windows et du parcours de mise à jour.
