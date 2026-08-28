const { analyserTextePdfEleves } = require('./dist/services/importPdf.service.js');
const texte = `LISTE DES ÉLÈVES DU LYCÉE — TESTE
Année scolaire 2026-2027
11ème L1
N°  PRÉNOM  NOM  SEXE  MATRICULE
1  Amadou  Traoré  M  RC16L1Q4701M
2  Aissata  Coulibaly  F  RC16L1Q4702F
12ème TSE
N°  PRÉNOM  NOM  SEXE  MATRICULE
1  Moussa  Diarra  M  RC12TSE001M`;
const lignes = analyserTextePdfEleves(texte, []);
if (lignes.length !== 3 || lignes[0].classeTexte !== '11ème L1' || lignes[1].matricule !== 'RC16L1Q4702F' || lignes[2].classeTexte !== '12ème TSE') process.exit(1);
console.log('CLASSE_CONTEXT_OK');
console.log(JSON.stringify(lignes));
