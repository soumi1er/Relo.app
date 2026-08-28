import PDFDocument from "pdfkit";
import { Trimestre } from "../types/enums";
import { prisma } from "../lib/prisma";
import { calculerMoyenneEleve, calculerClassement } from "./calcul.service";
const LIBELLES_TRIMESTRE: Record<Trimestre, string> = { T1: "1er Trimestre", T2: "2ème Trimestre", T3: "3ème Trimestre" };

export async function genererBulletinPDF(eleveId: string, trimestre: Trimestre): Promise<Buffer> {
  const eleve = await prisma.eleve.findUnique({ where: { id: eleveId }, include: { classe: true, ecole: true } });
  if (!eleve || !eleve.classeId || !eleve.classe) throw new Error("Élève introuvable ou non affecté à une classe.");
  const classe = eleve.classe;
  const pub = await prisma.publication.findUnique({ where: { classeId_trimestre: { classeId: eleve.classeId, trimestre } } });
  const moyenne = await calculerMoyenneEleve(eleve.id, eleve.classeId, trimestre);
  const classement = await calculerClassement(eleve.classeId, trimestre);
  const ligne = classement.find(x => x.eleveId === eleve.id);
  const moyennesClasse = classement.map(x => x.moyenne).filter((x): x is number => x !== null);
  const moyenneClasse = moyennesClasse.length ? moyennesClasse.reduce((a,b)=>a+b,0)/moyennesClasse.length : null;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 45 }); const chunks: Buffer[] = [];
    doc.on("data", c => chunks.push(c)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject);
    doc.fontSize(18).font("Helvetica-Bold").text(eleve.ecole.nom, { align: "center" });
    doc.fontSize(10).font("Helvetica").text([eleve.ecole.adresse, eleve.ecole.telephone].filter(Boolean).join(" • "), { align: "center" });
    doc.moveDown(.5).fontSize(15).font("Helvetica-Bold").text("BULLETIN DE NOTES", { align: "center" });
    doc.fontSize(11).font("Helvetica").text(LIBELLES_TRIMESTRE[trimestre], { align: "center" }); doc.moveDown(1.2);
    doc.text(`Élève : ${eleve.prenom} ${eleve.nom}`); doc.text(`Matricule : ${eleve.matricule}`); doc.text(`Classe : ${classe.nom}`); doc.moveDown(.8);
    const x=45; let y=doc.y; const widths=[210,95,75,100];
    doc.font("Helvetica-Bold").text("Matière",x,y).text("Moyenne /20",x+widths[0],y).text("Coeff.",x+widths[0]+widths[1],y).text("Observation",x+widths[0]+widths[1]+widths[2],y); y+=20; doc.moveTo(x,y).lineTo(525,y).stroke(); y+=8; doc.font("Helvetica");
    for (const m of moyenne.detailParMatiere) { if (y>720) { doc.addPage(); y=55; } doc.text(m.matiereNom,x,y).text(m.moyenne===null?"—":m.moyenne.toFixed(2),x+widths[0],y).text(String(m.coefficient),x+widths[0]+widths[1],y).text(m.moyenne===null?"Non évalué":m.moyenne>=10?"Satisfaisant":"À améliorer",x+widths[0]+widths[1]+widths[2],y); y+=19; }
    y+=8; doc.moveTo(x,y).lineTo(525,y).stroke(); y+=15; doc.font("Helvetica-Bold").fontSize(12).text(`Moyenne générale : ${moyenne.moyenneGenerale===null?"—":moyenne.moyenneGenerale.toFixed(2)} / 20`,x,y); y+=20; doc.font("Helvetica").fontSize(10).text(`Moyenne de la classe : ${moyenneClasse===null?"—":moyenneClasse.toFixed(2)} / 20`,x,y); doc.text(`Rang : ${ligne?.rang ?? "—"} / ${classement.length}`,x+270,y); y+=35;
    doc.font("Helvetica-Bold").text(pub?.publiee ? "Résultats publiés" : "Document de travail — résultats non publiés", x, y); y+=45;
    doc.font("Helvetica").text("Le Directeur", 390, y, { width: 120, align: "center" }); y+=55; doc.font("Helvetica-Bold").text(`${eleve.ecole.directeurPrenom ?? ""} ${eleve.ecole.directeurNom ?? ""}`.trim() || "Directeur", 365, y, { width: 170, align: "center" });
    doc.end();
  });
}
