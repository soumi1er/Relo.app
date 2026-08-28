# Exports et modifications hors ligne dans Relo

Relo propose désormais deux formats éditables depuis les écrans de travail : **Excel (.xlsx)** pour les corrections de données et **Word (.docx)** pour les impressions, annotations et archivages.

## Écrans équipés

Les boutons **Excel** et **Word** sont disponibles dans les listes d’élèves, les classes, les fiches de classe, les matières, les professeurs, les années scolaires, les notes administratives, les affectations professeur, les décisions de passage/redoublement, la saisie des notes et le relevé individuel de l’élève.

## Modifier une liste d’élèves

Depuis **Élèves**, utilisez **Excel** pour télécharger la liste filtrée ou **Modifier via Excel** pour préparer une correction. Les colonnes principales sont `Matricule`, `Nom`, `Prénom`, `Classe` et `Statut`. Pour un nouveau dossier, utilisez l’import PDF ou ajoutez une ligne dans un classeur en conservant les en-têtes.

Pour réimporter un fichier Excel, utilisez **Modifier via Excel**, sélectionnez le classeur, vérifiez la prévisualisation puis cliquez sur **Valider le réimport**. Lorsqu’un matricule correspond à un élève existant, Relo effectue une mise à jour de cette fiche. Lorsqu’il ne correspond à aucun élève, Relo propose une nouvelle fiche. Les lignes incomplètes sont ignorées et les erreurs sont signalées.

## Modifier des notes

Les exports de notes sont destinés au contrôle, à l’archivage et à la préparation des corrections. Les notes publiées restent protégées par les règles métier du serveur. Une modification ne doit pas être considérée comme validée tant qu’elle n’a pas été saisie ou contrôlée dans Relo.

## Excel ou Word ?

| Besoin | Format conseillé |
|---|---|
| Corriger un matricule, un nom ou une classe | Excel |
| Trier et filtrer une liste | Excel |
| Préparer une liste pour réimport | Excel |
| Imprimer une liste | Word |
| Ajouter des annotations manuelles | Word |
| Archiver une décision ou un relevé | Word ou PDF |

> Les fichiers exportés sont des copies de travail. Relo ne modifie aucune donnée au moment du téléchargement. Le réimport demande une validation explicite et les accès restent limités aux rôles autorisés côté serveur.
