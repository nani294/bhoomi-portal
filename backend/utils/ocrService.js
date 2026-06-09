/**
 * ocrService.js — Real OCR & Text Extraction for Bhoomi Documents
 *
 * Replaces the Math.random() simulation with actual file reading:
 *  - PDFs  → pdf-parse v2 (text layer via PDFParse class)
 *  - Images (JPG/PNG) → tesseract.js (Tesseract OCR engine)
 *
 * After extraction, regex patterns pull out the key fields the fraud
 * detection engine needs: ownerName, aadhaarNumber, surveyNumber,
 * registrationNumber, village, mandal, district, extent.
 */

const fs        = require('fs');
const path      = require('path');
const { PDFParse } = require('pdf-parse');    // pdf-parse v2 class-based API
const Tesseract = require('tesseract.js');

// ─── Field Extraction Patterns ──────────────────────────────────────────────

const PATTERNS = {
  aadhaarNumber: [
    /\b(\d{4}[\s\-]?\d{4}[\s\-]?\d{4})\b/,
  ],

  surveyNumber: [
    /survey\s*(?:no|number|#)[.:\s]*([A-Z0-9\/\-]+)/i,
    /s\.no[.:\s]*([A-Z0-9\/\-]+)/i,
    /khasra\s*no[.:\s]*([A-Z0-9\/\-]+)/i,
    /plot\s*no[.:\s]*([A-Z0-9\/\-]+)/i,
    /dag\s*no[.:\s]*([A-Z0-9\/\-]+)/i,
    /sy\.?\s*no[.:\s]*([A-Z0-9\/\-]+)/i,
  ],

  registrationNumber: [
    /(?:registration|reg\.?)\s*(?:no|number|#)[.:\s]*([A-Z0-9\/\-]+)/i,
    /doc(?:ument)?\s*no[.:\s]*([A-Z0-9\/\-]+)/i,
    /reference\s*(?:no|number)[.:\s]*([A-Z0-9\/\-]+)/i,
  ],

  ownerName: [
    /(?:owner|pattadar|applicant|name\s*of\s*owner|payee\s*name|name)[.:\s]+([A-Z][A-Za-z\s\.]{3,40}?)(?:\s*(?:s\/o|d\/o|w\/o|age|father|village|survey|$|\n))/i,
    /(?:shri|smt|mr|mrs|dr)[.:\s]+([A-Z][A-Za-z\s\.]{3,40})/i,
  ],

  village: [
    /village[.:\s]+([A-Za-z\s]{3,30}?)(?:\s*(?:mandal|taluk|tehsil|district|$|\n))/i,
    /gram[.:\s]+([A-Za-z\s]{3,30}?)(?:\s*(?:mandal|$|\n))/i,
  ],

  mandal: [
    /mandal[.:\s]+([A-Za-z\s]{3,30}?)(?:\s*(?:district|taluk|revenue|$|\n))/i,
    /taluk[.:\s]+([A-Za-z\s]{3,30}?)(?:\s*(?:district|$|\n))/i,
    /tehsil[.:\s]+([A-Za-z\s]{3,30}?)(?:\s*(?:district|$|\n))/i,
  ],

  district: [
    /district[.:\s]+([A-Za-z\s]{3,30}?)(?:\s*(?:state|andhra|telangana|pin|$|\n))/i,
    /dist[.:\s]+([A-Za-z\s]{3,30}?)(?:\s*(?:state|$|\n))/i,
  ],

  extent: [
    /(?:extent|area|land\s*area)[.:\s]+([\d.]+\s*(?:acres?|guntas?|cents?|hectares?|sq\s*(?:mt|yard|ft)?))/i,
    /([\d.]+\s*acres?)/i,
    /([\d.]+\s*guntas?)/i,
    /([\d.]+\s*hectares?)/i,
  ],
};

function extractField(text, fieldPatterns) {
  for (const pattern of fieldPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().replace(/\s+/g, ' ');
    }
  }
  return null;
}

function parseFields(rawText) {
  const data = { rawText };

  for (const [field, patterns] of Object.entries(PATTERNS)) {
    data[field] = extractField(rawText, patterns) || null;
  }

  if (data.aadhaarNumber) {
    data.aadhaarNumber = data.aadhaarNumber.replace(/[\s\-]/g, '');
  }

  const keyFields = ['ownerName', 'aadhaarNumber', 'surveyNumber', 'district', 'village', 'extent'];
  const found = keyFields.filter(f => data[f] !== null).length;
  data.confidence = Math.round((found / keyFields.length) * 100);

  return data;
}

// ─── PDF Extraction (pdf-parse v2 class API) ─────────────────────────────────

async function extractFromPDF(filePath) {
  const absPath = path.resolve(filePath);
  const fileUrl = 'file://' + absPath;

  const parser = new PDFParse({ verbosity: 0, url: fileUrl });
  await parser.load();
  const result = await parser.getText();

  // pdf-parse v2 getText() returns { pages: [{ text, num }, ...] }
  let text = '';
  if (result && result.pages) {
    text = result.pages.map(p => p.text || '').join('\n');
  } else if (typeof result === 'string') {
    text = result;
  }

  if (!text.trim()) {
    return null; // scanned PDF — no text layer
  }

  return parseFields(text);
}

// ─── Image OCR via Tesseract ─────────────────────────────────────────────────

async function extractFromImage(filePath) {
  const { data: { text } } = await Tesseract.recognize(filePath, 'eng', {
    logger: () => {}
  });
  return parseFields(text || '');
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * extractOCRData(filePath, mimeType)
 *
 * Returns { ownerName, aadhaarNumber, surveyNumber, registrationNumber,
 *           village, mandal, district, extent, confidence, rawText }
 *
 * All string fields are null when not found. confidence is 0–100.
 * Throws on unreadable / missing file.
 */
async function extractOCRData(filePath, mimeType) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const ext = path.extname(filePath).toLowerCase();

  if (mimeType === 'application/pdf' || ext === '.pdf') {
    const pdfResult = await extractFromPDF(filePath);
    if (pdfResult) return pdfResult;
    // Scanned PDF — no text layer
    return {
      ownerName: null, aadhaarNumber: null, surveyNumber: null,
      registrationNumber: null, village: null, mandal: null,
      district: null, extent: null, confidence: 0,
      rawText: '(Scanned PDF — no text layer detected; manual review required)'
    };
  }

  if (['image/jpeg', 'image/jpg', 'image/png'].includes(mimeType) ||
      ['.jpg', '.jpeg', '.png'].includes(ext)) {
    return await extractFromImage(filePath);
  }

  return {
    ownerName: null, aadhaarNumber: null, surveyNumber: null,
    registrationNumber: null, village: null, mandal: null,
    district: null, extent: null, confidence: 0,
    rawText: `(File type ${mimeType} not supported for automated OCR)`
  };
}

module.exports = { extractOCRData };
