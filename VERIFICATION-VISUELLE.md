# Vérification visuelle

L’aperçu local de Relo a été ouvert dans Chromium sur `http://127.0.0.1:5173`. L’écran de connexion présente désormais un fond bleu nuit avec halos colorés, un panneau éditorial à gauche (« Le lycée malien, en mouvement. »), trois promesses produit et un formulaire blanc distinct à droite. Les éléments sont lisibles, le contraste est net et les rôles Administration, Professeur, Parent d’élève et Élève restent accessibles.

La compilation frontend réussit avec Vite et TypeScript. La compilation backend réussit également après l’ajout du service d’analyse Relo IA et de la route protégée `/api/ia/insights`. Le backend utilise une base SQLite locale ; le moteur IA distant est facultatif et un moteur de secours local conserve une réponse fonctionnelle si aucune clé n’est configurée.

Le parcours authentifié n’a pas pu être visualisé dans le navigateur distant, car le navigateur et le processus backend de test ne partagent pas le même espace réseau local. Cette limitation n’affecte pas la compilation ni le fonctionnement prévu dans Electron, où le backend est lancé avec l’application.
