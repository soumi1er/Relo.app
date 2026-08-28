# Migration Electron → Tauri de Relo

## Objectif

Relo Desktop utilise désormais Tauri 2 comme runtime natif principal, avec React et TypeScript conservés côté interface. L’API Express, Prisma et SQLite restent inchangés afin de protéger les fonctionnalités métier déjà validées.

## Architecture cible

| Ancien élément | Nouvelle implémentation | Effet |
|---|---|---|
| Electron | Tauri 2 + Rust | Fenêtre native plus légère et cycle de vie contrôlé par Rust. |
| Electron Main Process | `desktop/src-tauri/src/lib.rs` | Lance, supervise et arrête le backend local. |
| React/Vite | React/Vite conservé | Aucun écran métier n’est perdu pendant la migration. |
| CSS existant | Tailwind CSS 3 + tokens Relo | Migration progressive sans réécriture brutale des écrans existants. |
| Composants maison | Primitive `Button` de style shadcn/ui + `cn` | Base réutilisable pour les prochaines migrations d’écran. |
| Animations CSS | Motion | Onboarding et hero Relo IA utilisent des transitions déclaratives. |
| Icônes | Lucide React | Iconographie conservée et homogène. |
| Backend | Express + Prisma + SQLite conservé | Routes, comptes, imports, notes et Relo IA restent compatibles. |

## Démarrage du backend local

En mode développement, Rust lance `node` depuis le PATH et utilise `../../backend`. En production, le paquet Tauri embarque le backend compilé dans `resources/backend` et un runtime Node préparé par `scripts/prepare-tauri-runtime.mjs`.

Le runtime est généré pour la plateforme de build : `node` sous Linux/macOS et `node.exe` sous Windows. La base SQLite est créée dans le dossier de données utilisateur Tauri. Aucun `.env`, secret OpenAI ou fichier SQLite de développement n’est inclus dans le paquet.

## Configuration Tauri

`desktop/src-tauri/tauri.conf.json` configure :

- `frontendDist: ../dist` pour servir le frontend Vite compilé ;
- `devUrl: http://localhost:5173` pour le développement ;
- les ressources backend mappées explicitement vers `backend/` ;
- le runtime Node mappé vers `bundled-node/` ;
- l’identifiant `dev.relo.education` ;
- les icônes Relo générées depuis le logo produit ;
- les cibles natives Tauri disponibles sur la plateforme de compilation.

## Commandes

```bash
cd desktop
npm install
npm run tauri:dev
npm run tauri:build
```

`tauri:dev` lance Vite et la fenêtre native Tauri. `tauri:build` prépare le runtime Node, compile React, compile Rust et produit les bundles natifs.

## Windows

La génération d’un installateur `.exe` doit être effectuée sur Windows, avec WebView2 et les Microsoft C++ Build Tools. La source contient le script de préparation multiplateforme ; il sélectionne automatiquement `node.exe`. Les utilisateurs finaux n’ont pas besoin d’installer Rust, Node.js ou Electron.

Le build Linux de cette session a été vérifié avec succès et a produit une AppImage Tauri. Le build Windows n’est pas simulé depuis Linux : il doit être compilé sur Windows pour obtenir un binaire et une signature adaptés à cette plateforme.

## Vérifications effectuées

Le backend et le frontend ont été compilés. Prisma a été généré et synchronisé. Le test de détection contextuelle des classes maliennes a confirmé la conservation de `11ème L1`, `12ème TSE` et des matricules. Le build Tauri a produit l’exécutable natif ainsi que les bundles AppImage, DEB et RPM. L’AppImage extraite contient `backend/dist/server.js` et `bundled-node/node` aux chemins attendus par Rust, sans `.env` ni base de développement.

## Références officielles

La configuration suit la documentation Tauri sur l’intégration [Vite](https://v2.tauri.app/start/frontend/vite/), l’initialisation d’un projet existant [React/Vite](https://v2.tauri.app/start/create-project/), l’incorporation de ressources [Tauri](https://v2.tauri.app/develop/resources/) et le runtime Node en sidecar [Node.js as a sidecar](https://v2.tauri.app/learn/sidecar-nodejs/).
