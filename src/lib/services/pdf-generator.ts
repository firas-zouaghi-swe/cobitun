import { promises as fs } from 'fs';
import path from 'path';

// Use workspace-local `upload` directory so PDF generation works on Windows and CI
function getUploadDir(): string { return path.resolve(process.cwd(), 'upload'); }

// ==================== TYPE DEFINITIONS ====================

export interface PolicyContractData {
  policyNumber: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  sector: string;
  annualTurnover: number;
  premiumAmount: number;
  currency: string;
  effectiveDate: string;
  expiryDate: string;
  coverageTerms: string[];
  cloudProvider?: string;
  signatureBlocks: { label: string; line: string }[];
}

export interface DeclarationOfLossData {
  claimId: string;
  policyNumber: string;
  customerName: string;
  lossAmount: number;
  lossStartDate: string;
  lossEndDate: string;
  lossDescription?: string;
  declarationDate: string;
}

// ==================== MINIMAL PDF GENERATOR ====================
// Generates PDFs using raw PDF specification to avoid font dependency issues in Next.js

function escapePdf(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdf(title: string, contentLines: { label: string; value: string; bold?: boolean }[], sections: { title: string; rows: { label: string; value: string }[] }[]): Buffer {
  const objects: string[] = [];
  
  // Object 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  
  // Object 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  
  // Build content stream
  let stream = '';
  let y = 780;
  const lineHeight = 14;
  const sectionGap = 10;
  const marginLeft = 50;
  const marginRight = 545;
  
  // Title
  stream += `BT\n/F1 18 Tf\n50 ${y} Td\n(COBITUN) Tj\nET\n`;
  y -= 22;
  stream += `BT\n/F2 12 Tf\n50 ${y} Td\n(${escapePdf(title)}) Tj\nET\n`;
  y -= 18;
  stream += `0.2 0.35 0.6 rg\n50 ${y} m ${marginRight} ${y} l S\n0 0 0 rg\n`;
  y -= lineHeight + 5;

  // Content lines
  for (const line of contentLines) {
    if (y < 60) break; // Page overflow protection
    const font = line.bold ? '/F2' : '/F1';
    const fontSize = line.bold ? 10 : 9;
    stream += `BT\n${font} ${fontSize} Tf\n50 ${y} Td\n(${escapePdf(line.label)}:  ${escapePdf(line.value)}) Tj\nET\n`;
    y -= lineHeight;
  }

  y -= sectionGap;

  // Sections
  for (const section of sections) {
    if (y < 80) break;
    stream += `0.2 0.35 0.6 rg\n50 ${y} m ${marginRight} ${y} l S\n0 0 0 rg\n`;
    y -= lineHeight;
    stream += `BT\n/F2 11 Tf\n50 ${y} Td\n(${escapePdf(section.title)}) Tj\nET\n`;
    y -= lineHeight;
    for (const row of section.rows) {
      if (y < 60) break;
      stream += `BT\n/F1 9 Tf\n60 ${y} Td\n(${escapePdf(row.label)}) Tj\nET\n`;
      stream += `BT\n/F1 9 Tf\n250 ${y} Td\n(${escapePdf(row.value)}) Tj\nET\n`;
      y -= lineHeight;
    }
    y -= 5;
  }

  // Signature blocks
  y -= 20;
  if (y > 120) {
    stream += `0.2 0.35 0.6 rg\n50 ${y} m ${marginRight} ${y} l S\n0 0 0 rg\n`;
    y -= lineHeight;
    stream += `BT\n/F2 11 Tf\n50 ${y} Td\n(Signatures) Tj\nET\n`;
    y -= 30;
    stream += `BT\n/F1 9 Tf\n50 ${y} Td\n(Date: _________________) Tj\nET\n`;
    stream += `BT\n/F1 9 Tf\n300 ${y} Td\n(Date: _________________) Tj\nET\n`;
    y -= 30;
    stream += `BT\n/F1 9 Tf\n50 ${y} Td\n(Signature: _________________) Tj\nET\n`;
    stream += `BT\n/F1 9 Tf\n300 ${y} Td\n(Signature: _________________) Tj\nET\n`;
    y -= 15;
    stream += `BT\n/F1 8 Tf\n50 ${y} Td\n(L'Assure / The Insured) Tj\nET\n`;
    stream += `BT\n/F1 8 Tf\n300 ${y} Td\n(COBITUN / Compagnie) Tj\nET\n`;
  }

  // Footer
  stream += `BT\n/F1 7 Tf\n50 30 Td\n(COBITUN - Cloud Outage Business Interruption Tunisia Cover | ${escapePdf(title)} | Page 1) Tj\nET\n`;

  // Object 3: Page
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj`);
  
  // Object 4: Content stream
  objects.push(`4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj`);
  
  // Object 5: Font Helvetica (built-in Type1)
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj');
  
  // Object 6: Font Helvetica-Bold (built-in Type1)
  objects.push('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj');

  // Build PDF
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }
  
  // Cross-reference table
  const xrefOffset = pdf.length;
  pdf += 'xref\n';
  pdf += `0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }
  
  // Trailer
  pdf += 'trailer\n';
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += `${xrefOffset}\n`;
  pdf += '%%EOF';

  return Buffer.from(pdf, 'latin1');
}

// ==================== POLICY CONTRACT PDF ====================

export async function generatePolicyContract(data: PolicyContractData): Promise<string> {
  const uploadDir = getUploadDir();
  await fs.mkdir(uploadDir, { recursive: true });
  
  const uniqueSuffix = Date.now().toString(36);
  const filePath = path.join(uploadDir, `COBITUN_police_assurance_parametrique_${uniqueSuffix}.pdf`);

  const contentLines = [
    { label: 'Police N', value: data.policyNumber, bold: true },
    { label: 'Assure', value: data.customerName },
    { label: 'Email', value: data.customerEmail },
    { label: 'Adresse', value: data.customerAddress },
    { label: 'Secteur', value: data.sector },
    { label: 'Chiffre d\'affaires annuel', value: `${data.annualTurnover.toLocaleString()} ${data.currency}` },
    { label: 'Prime', value: `${data.premiumAmount.toLocaleString()} ${data.currency}`, bold: true },
    { label: 'Date d\'effet', value: data.effectiveDate },
    { label: 'Date d\'expiration', value: data.expiryDate },
    { label: 'Fournisseur cloud', value: data.cloudProvider || 'N/A' },
  ];

  const sections = [
    {
      title: 'Conditions de couverture / Coverage Terms',
      rows: data.coverageTerms.map((term, i) => ({ label: `${i + 1}.`, value: term })),
    },
    {
      title: 'Dispositions generales / General Provisions',
      rows: [
        { label: 'Declenchement', value: 'Declenchement automatique quand la panne depasse le MTTR du SLA' },
        { label: 'Source de donnees', value: 'IODA - Georgia Tech Internet Intelligence' },
        { label: 'Delai d\'indemnisation', value: '15 minutes apres declenchement confirme' },
        { label: 'Monnaie', value: 'TND (Dinar tunisien)' },
        { label: 'Juridiction', value: 'Tunis, Tunisie' },
      ],
    },
  ];

  const pdfBuffer = buildPdf("POLICE D'ASSURANCE PARAMETRIQUE", contentLines, sections);
  await fs.writeFile(filePath, pdfBuffer);
  
  return filePath;
}

// ==================== DECLARATION OF LOSS PDF ====================

export async function generateDeclarationOfLoss(data: DeclarationOfLossData): Promise<string> {
  const uploadDir = getUploadDir();
  await fs.mkdir(uploadDir, { recursive: true });

  const uniqueSuffix = Date.now().toString(36);
  const filePath = path.join(uploadDir, `COBITUN_declaration_de_sinistre_${uniqueSuffix}.pdf`);

  const contentLines = [
    { label: 'Reference sinistre', value: data.claimId, bold: true },
    { label: 'Police', value: data.policyNumber },
    { label: 'Declarant', value: data.customerName },
    { label: 'Montant de la perte', value: `${data.lossAmount.toLocaleString()} TND`, bold: true },
    { label: 'Date de debut', value: data.lossStartDate },
    { label: 'Date de fin', value: data.lossEndDate },
    { label: 'Description', value: data.lossDescription || 'Aucune description fournie' },
    { label: 'Date de declaration', value: data.declarationDate },
  ];

  const sections = [
    {
      title: 'Attestation / Attestation',
      rows: [
        { label: '1.', value: 'Je certifie que les informations fournies sont exactes et completes' },
        { label: '2.', value: 'Je reconnais que toute fausse declaration peut entrainer le rejet de la demande' },
        { label: '3.', value: 'J\'autorise COBITUN a verifier les donnees de panne aupres de Georgia Tech IODA' },
        { label: '4.', value: 'Je comprends que le paiement est conditionne a la confirmation des donnees objectives' },
      ],
    },
  ];

  const pdfBuffer = buildPdf('DECLARATION DE SINISTRE', contentLines, sections);
  await fs.writeFile(filePath, pdfBuffer);
  
  return filePath;
}

