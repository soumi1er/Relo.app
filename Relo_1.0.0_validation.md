# Relo 1.0.0 — validation de la refonte

## Résultat

La version de travail a été recompilée avec succès côté backend, frontend Vite et processus Electron. Une AppImage Linux a été générée. L’archive source Windows contient le code, les scripts d’installation, les assets et la documentation, sans fichier `.env`, base SQLite, tests temporaires ou clé OpenAI.

## Fonctions finalisées

| Domaine | Vérification |
|---|---|
| Comptes | Jusqu’à six comptes récents mémorisés localement, sans mot de passe ni token sauvegardé. |
| Inscription | Le compte administrateur est créé avant le choix du type d’établissement. L’onboarding post-inscription mène à la configuration des parcours. |
| Établissement | Le shell charge le nom réel de l’établissement et l’année scolaire active. Le choix de type est accessible dans Établissement. |
| Classes | Les standards maliens sont proposés comme modèles sélectionnables ; aucune série fictive n’est créée automatiquement. |
| Élèves | La route PATCH est unique et accepte nom, prénom, matricule, date, sexe, classe et statut, avec contrôles d’appartenance et de doublon. |
| Import | PDF, scans/images, Word, Excel, CSV et texte restent prévisualisables et modifiables avant écriture. |
| Relo IA | Insights calculés à partir des données réelles, actions navigables et chat contextuel via `POST /api/ia/chat`, avec repli local déterministe. |
| Identité | Logos Relo.dev et Relo importés comme assets Vite afin de rester visibles dans le bundle Electron. |
| Interface | Palette claire ivoire, teal, corail et ocre ; hiérarchie renforcée ; styles dédiés à l’onboarding, au chat et aux actions. |

## Commandes exécutées

- `backend: npm run build`
- `backend: npx prisma generate`
- `backend: npx prisma db push`
- `desktop: npm run build`
- `desktop: npm run electron:build`
- Vérification de l’archive : aucun `.env`, `relo.db`, dossier de données ou test temporaire inclus.

## Limites connues

La lecture locale des PDF scannés reste dépendante d’un moteur OCR ou de Relo IA lorsque le document ne contient aucun texte exploitable. L’intégration OpenAI est facultative et s’active uniquement côté backend. Les builds signalent seulement un avertissement de taille de bundle Vite, sans échec.

## Sécurité

La clé OpenAI communiquée dans l’historique doit être révoquée et remplacée. Elle n’est pas présente dans l’archive source ni dans le paquet compilé. Une nouvelle clé doit être ajoutée uniquement dans le `backend/.env` local de la machine qui exécute Relo.
