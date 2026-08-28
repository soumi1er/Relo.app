from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

out = "/home/ubuntu/relo_nouveau/backend/verification-liste-classes.pdf"
doc = SimpleDocTemplate(out, pagesize=A4, rightMargin=16*mm, leftMargin=16*mm, topMargin=14*mm, bottomMargin=14*mm)
styles = getSampleStyleSheet()
story = [Paragraph("LISTE DES ÉLÈVES DU LYCÉE — TEST IMPORT RELO", styles["Title"]), Paragraph("Année scolaire 2026-2027 · classes repérées dans les en-têtes", styles["Normal"]), Spacer(1, 8*mm)]
sections = [
    ("11ème L1", [["N°", "PRÉNOM", "NOM", "SEXE", "MATRICULE"], [1, "Amadou", "Traoré", "M", "RC16L1Q4701M"], [2, "Aissata", "Coulibaly", "F", "RC16L1Q4702F"], [3, "Moussa", "Diarra", "M", "RC16L1Q4703M"]]),
    ("11ème Sciences", [["N°", "PRÉNOM", "NOM", "SEXE", "MATRICULE"], [1, "Fatoumata", "Konaté", "F", "SC11Q4701F"], [2, "Oumar", "Touré", "M", "SC11Q4702M"]]),
    ("12ème TSE", [["N°", "PRÉNOM", "NOM", "SEXE", "MATRICULE"], [1, "Mariam", "Diallo", "F", "TSE12Q001F"], [2, "Boubacar", "Cissé", "M", "TSE12Q002M"]]),
]
for idx, (classe, rows) in enumerate(sections):
    story.append(Paragraph(classe, styles["Heading2"]))
    table = Table(rows, colWidths=[13*mm, 34*mm, 42*mm, 20*mm, 56*mm])
    table.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#d9d9d9")), ("GRID", (0,0), (-1,-1), .4, colors.HexColor("#8d8d8d")), ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"), ("FONTSIZE", (0,0), (-1,-1), 9), ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#f4f4f4")]), ("LEFTPADDING", (0,0), (-1,-1), 5), ("RIGHTPADDING", (0,0), (-1,-1), 5), ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5)]))
    story.append(table)
    if idx != len(sections)-1: story.append(Spacer(1, 8*mm))
doc.build(story)
print(out)
