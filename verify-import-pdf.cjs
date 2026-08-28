const fs = require('node:fs');
const { extraireTexteAvecMiseEnPage } = require('./dist/services/pdfExtraction.service.js');
const { analyserTextePdfEleves } = require('./dist/services/importPdf.service.js');
(async () => {
  const texte = await extraireTexteAvecMiseEnPage(fs.readFileSync('./verification-liste-classes.pdf'));
  const lignes = analyserTextePdfEleves(texte, []);
  const classes = lignes.map((l) => l.classeTexte);
  const attendu = ['11ème L1', '11ème Sciences', '12ème TSE'];
  if (lignes.length !== 7 || !attendu.every((c) => classes.includes(c)) || lignes[0].matricule !== 'RC16L1Q4701M' || lignes[6].matricule !== 'TSE12Q002M') {
    console.error(JSON.stringify({ texte, lignes }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, total: lignes.length, classes: [...new Set(classes)], matricules: lignes.map((l) => l.matricule) }));
})();
