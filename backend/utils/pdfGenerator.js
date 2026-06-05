const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const generateQR = async (text) => {
  try {
    return await QRCode.toDataURL(text);
  } catch (err) {
    console.error('QR Generation failed', err);
    return null;
  }
};

const getPrefix = (type) => {
  const map = {
    mutation: 'MUT',
    land_verification: 'LOVC',
    encumbrance_certificate: 'EC',
    new_pattadar_passbook: 'PB',
    duplicate_pattadar_passbook: 'PBD',
    passbook_correction: 'PBC',
    possession_certificate: 'PC',
    survey_boundary_verification: 'SUR'
  };
  return map[type] || 'CERT';
};

const getTitle = (type) => {
  const map = {
    mutation: 'Mutation Approval Certificate',
    land_verification: 'Land Ownership Verification Certificate',
    encumbrance_certificate: 'Encumbrance Certificate (EC)',
    new_pattadar_passbook: 'Pattadar Passbook',
    duplicate_pattadar_passbook: 'Duplicate Pattadar Passbook',
    passbook_correction: 'Passbook Correction Acknowledgement',
    possession_certificate: 'Possession Certificate',
    survey_boundary_verification: 'Survey & Boundary Verification Report'
  };
  return map[type] || 'Official Certificate';
};

exports.generatePDF = async (app, officerName, isPassbook = false) => {
  return new Promise(async (resolve, reject) => {
    try {
      const year = new Date().getFullYear();
      const prefix = getPrefix(app.applicationType);
      const rand = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
      const certificateNumber = `${prefix}-${year}-${rand}`;
      const verificationCode = uuidv4().split('-')[0].toUpperCase(); // Short code for easy typing
      const issueDate = new Date();
      const fileName = `${certificateNumber}.pdf`;
      const pdfPath = `/uploads/certificates/${fileName}`;
      const fullPath = path.join(__dirname, '..', 'uploads', 'certificates', fileName);
      
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/verify.html?code=${verificationCode}`;
      const qrDataUrl = await generateQR(`Cert No: ${certificateNumber}\nApp ID: ${app.applicationId}\nVerify at: ${verificationUrl}`);

      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const writeStream = fs.createWriteStream(fullPath);
      doc.pipe(writeStream);

      // Background / Border
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke(isPassbook ? '#1d9e75' : '#0d2137');
      doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50).stroke(isPassbook ? '#1d9e75' : '#0d2137');

      // Header
      doc.fontSize(20).fillColor(isPassbook ? '#1d9e75' : '#0d2137').text('GOVERNMENT OF ANDHRA PRADESH', { align: 'center' });
      doc.fontSize(14).text('REVENUE DEPARTMENT', { align: 'center' });
      doc.moveDown();
      
      doc.fontSize(18).fillColor('#000').text(getTitle(app.applicationType), { align: 'center', underline: true });
      doc.moveDown(2);

      // Certificate Info Box
      const topY = doc.y;
      doc.fontSize(10).text(`Certificate No: ${certificateNumber}`, 50, topY);
      doc.text(`Application ID: ${app.applicationId}`, 50, topY + 15);
      doc.text(`Issue Date: ${issueDate.toLocaleDateString('en-IN')}`, doc.page.width - 200, topY, { align: 'right' });
      doc.moveDown(3);

      // Content
      doc.fontSize(12).text('This is to certify that the land details mentioned below have been verified and approved by the competent authority.', { align: 'justify' });
      doc.moveDown(2);

      const tableTop = doc.y;
      const leftCol = 50;
      const rightCol = 250;

      const drawRow = (label, value, y) => {
        doc.font('Helvetica-Bold').text(label, leftCol, y);
        doc.font('Helvetica').text(value || 'N/A', rightCol, y);
      };

      let currentY = tableTop;
      drawRow('Applicant Name:', app.applicantName, currentY); currentY += 20;
      drawRow('Aadhaar Number:', '********' + (app.aadhaarNumber || '').slice(-4), currentY); currentY += 20;
      drawRow('Survey Number:', app.surveyNumber + (app.subDivisionNumber ? ` / ${app.subDivisionNumber}` : ''), currentY); currentY += 20;
      drawRow('District:', app.district, currentY); currentY += 20;
      drawRow('Mandal:', app.mandal, currentY); currentY += 20;
      drawRow('Village:', app.village, currentY); currentY += 20;
      drawRow('Land Extent:', app.extent, currentY); currentY += 30;

      if (app.applicationType === 'mutation' && app.mutationDetails) {
        doc.font('Helvetica-Bold').fontSize(14).text('Mutation Details', leftCol, currentY); currentY += 20;
        doc.fontSize(12);
        drawRow('Transfer Type:', app.mutationDetails.transferType, currentY); currentY += 20;
        drawRow('Previous Owner:', app.mutationDetails.previousOwnerName, currentY); currentY += 20;
        drawRow('New Owner:', app.mutationDetails.newOwnerName, currentY); currentY += 20;
        drawRow('Reg. Doc Number:', app.mutationDetails.registrationDocNumber, currentY); currentY += 30;
      } else if (app.applicationType === 'encumbrance_certificate' && app.ecDetails) {
        doc.font('Helvetica-Bold').fontSize(14).text('EC Details', leftCol, currentY); currentY += 20;
        doc.fontSize(12);
        drawRow('Search Period:', `${new Date(app.ecDetails.periodFrom).toLocaleDateString()} to ${new Date(app.ecDetails.periodTo).toLocaleDateString()}`, currentY); currentY += 20;
        drawRow('Purpose:', app.ecDetails.purpose, currentY); currentY += 30;
      }

      doc.font('Helvetica').text('This document is digitally generated and requires no physical signature. The authenticity of this document can be verified online.', 50, currentY + 30, { align: 'justify' });

      // Footer & QR Code
      const bottomY = doc.page.height - 180;
      
      if (qrDataUrl) {
        // Strip data prefix to get raw base64
        const imgData = qrDataUrl.split(';base64,').pop();
        doc.image(Buffer.from(imgData, 'base64'), 50, bottomY, { width: 80 });
      }
      
      doc.fontSize(10);
      doc.text(`Digital Verification Code: ${verificationCode}`, 50, bottomY + 90);
      doc.text(verificationUrl, 50, bottomY + 105, { link: verificationUrl, color: 'blue' });

      doc.text(`Issuing Authority:`, doc.page.width - 250, bottomY + 40, { align: 'center' });
      doc.font('Helvetica-Bold').text(officerName, doc.page.width - 250, bottomY + 60, { align: 'center' });
      doc.font('Helvetica').text(isPassbook ? 'Tahsildar' : 'Revenue Officer / Tahsildar', doc.page.width - 250, bottomY + 75, { align: 'center' });
      doc.text('Government of Andhra Pradesh', doc.page.width - 250, bottomY + 90, { align: 'center' });

      doc.end();

      writeStream.on('finish', () => {
        resolve({
          certificateNumber,
          verificationCode,
          issueDate,
          issuingOfficer: officerName,
          pdfPath
        });
      });

      writeStream.on('error', (err) => reject(err));
    } catch (error) {
      reject(error);
    }
  });
};
