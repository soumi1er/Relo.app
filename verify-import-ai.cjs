require('dotenv/config');
const fs = require('node:fs');
const { analyserDocumentAvecIA } = require('./dist/services/pdfIA.service.js');
(async () => {
  if (!process.env.OPENAI_API_KEY) { console.log('IA_NON_CONFIGUREE'); process.exit(0); }
  const base64 = fs.readFileSync('./verification-liste-classes.pdf').toString('base64');
  const lignes = await analyserDocumentAvecIA(base64, 'application/pdf', 'verification-liste-classes.pdf');
  const classes = [...new Set(lignes.map((l) => l.classeTexte).filter(Boolean))];
  const matricules = lignes.map((l) => l.matricule).filter(Boolean);
  if (lignes.length < 6 || classes.length < 3 || matricules.length < 6) {
    console.error(JSON.stringify({ total: lignes.length, classes, matricules: matricules.length }));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, total: lignes.length, classes, matricules: matricules.length }));
})().catch((error) => { console.error(error.message || 'IA_TEST_FAILED'); process.exit(1); });
