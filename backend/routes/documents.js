const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, authorize } = require('../middleware/auth');
const { Document, AuditLog } = require('../models/index');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|jpg|jpeg|png|doc|docx/;
    if (allowed.test(path.extname(file.originalname).toLowerCase())) return cb(null, true);
    cb(new Error('Invalid file type. Only PDF, JPG, PNG, DOC allowed.'));
  }
});

router.use(protect);

// Upload document
router.post('/upload', upload.single('document'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const doc = await Document.create({
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: `/uploads/${req.file.filename}`,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      documentType: req.body.documentType || 'other',
      uploadedBy: req.user._id,
      relatedApplication: req.body.applicationId || null,
      relatedLandRecord: req.body.landRecordId || null,
      ocrStatus: 'pending'
    });
    // Simulate OCR Extraction & Identity Verification
    setTimeout(async () => {
      try {
        const Application = require('../models/Application');
        
        // --- BACKEND SECURITY: Do NOT trust body hints (ownerName, etc) ---
        // For simulation, we use the Application data to decide if it's a "Match" or "Mismatch"
        // in a real system, this would be actual OCR extraction.
        
        let extractedData = {
          ownerName: 'Security Check Failed',
          aadhaarNumber: '000000000000',
          surveyNumber: 'MISMATCH-000',
          confidence: 0
        };

        if (doc.relatedApplication) {
          const app = await Application.findById(doc.relatedApplication);
          if (app) {
             // Simulating a 90% success rate for "Extracted Data"
             const isSuccess = Math.random() > 0.1;
             extractedData = {
               ownerName: isSuccess ? app.applicantName : 'Forged Name',
               aadhaarNumber: isSuccess ? app.aadhaarNumber : '999999999999',
               surveyNumber: isSuccess ? (app.surveyNumber || 'LAND-101') : 'ERR-404',
               registrationNumber: `REG-${Math.floor(Math.random()*1000)}`,
               village: app.village || 'UNKNOWN',
               mandal: app.mandal || 'UNKNOWN',
               district: app.district || 'UNKNOWN',
               extent: app.extent || '1.0',
               confidence: Math.floor(Math.random() * 10 + 85)
             };
          }
        }

        const updatedDoc = await Document.findByIdAndUpdate(doc._id, {
          ocrStatus: 'completed',
          ocrData: { ...extractedData, rawText: `Extracted secure metadata for ${doc.documentType}` }
        }, { new: true });

        // If linked to an application, run consistency check
        if (doc.relatedApplication) {
          const app = await Application.findById(doc.relatedApplication);
          if (app) {
            const mismatches = [];
            let docRiskScore = 0;

            // Identity Consistency Rules
            if (doc.documentType === 'aadhaar' || doc.documentType === 'id_proof') {
              if (extractedData.ownerName.toLowerCase() !== app.applicantName.toLowerCase()) {
                mismatches.push('Name Mismatch (ID vs Application)');
                docRiskScore += 20;
              }
              if (extractedData.aadhaarNumber !== app.aadhaarNumber) {
                mismatches.push('Aadhaar Mismatch (ID vs Application)');
                docRiskScore += 40;
              }
            }

            // Land Consistency Rules
            if (['sale_deed', 'pattadar_passbook', 'mutation_deed', 'encumbrance_certificate', 'possession_certificate', 'survey_map'].includes(doc.documentType)) {
              if (app.surveyNumber && extractedData.surveyNumber !== app.surveyNumber) {
                mismatches.push(`Survey Number Mismatch (${doc.documentType})`);
                docRiskScore += 40;
              }
              if (app.village && extractedData.village !== app.village) {
                mismatches.push('Village Mismatch (Document vs Application)');
                docRiskScore += 15;
              }
              if (app.district && extractedData.district !== app.district) {
                mismatches.push('District Mismatch (Document vs Application)');
                docRiskScore += 15;
              }
              if (app.extent && extractedData.extent !== app.extent) {
                mismatches.push('Extent Mismatch (Document vs Application)');
                docRiskScore += 25;
              }
            }

            if (mismatches.length > 0) {
              app.isFlagged = true;
              app.fraudScore = (app.fraudScore || 0) + docRiskScore;
              // Add only new reasons
              mismatches.forEach(m => {
                if (!app.flagReasons.includes(m)) app.flagReasons.push(m);
              });
              await app.save();
              
              await AuditLog.create({
                action: 'Document Inconsistency Detected', module: 'document',
                entityId: app._id, details: `Mismatches in ${doc.documentType}: ${mismatches.join(', ')}`,
                ipAddress: 'System'
              });
            }
          }
        }
      } catch (err) {
        console.error('OCR Background Task Error:', err);
      }
    }, 2000);

    await AuditLog.create({
      user: req.user._id, userName: req.user.fullName, userRole: req.user.role,
      action: 'Document Upload', module: 'document',
      details: `Uploaded ${doc.documentType}: ${doc.originalName}`,
      ipAddress: req.ip
    });
    res.status(201).json({ success: true, message: 'Document uploaded successfully.', data: doc });
  } catch (err) { next(err); }
});

// Get documents for application
router.get('/application/:applicationId', async (req, res, next) => {
  try {
    const Application = require('../models/Application');
    const app = await Application.findById(req.params.applicationId);
    
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

    // Authorization Check
    const isOwner = app.applicant.toString() === req.user._id.toString();
    const isAssigned = app.assignedTo && app.assignedTo.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAssigned && !isAdmin) {
      await AuditLog.create({
        user: req.user._id, userName: req.user.fullName, userRole: req.user.role,
        action: 'Unauthorized Document Access', module: 'document',
        entityId: req.params.applicationId,
        details: `User tried to access documents for application ${app.applicationId}`,
        ipAddress: req.ip, status: 'warning'
      });
      return res.status(403).json({ success: false, message: 'Access denied. You are not authorized to view these documents.' });
    }

    const docs = await Document.find({ relatedApplication: req.params.applicationId }).populate('uploadedBy', 'fullName');
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
});

// Verify document (officer)
router.patch('/:id/verify', authorize('admin', 'verification_officer', 'registrar', 'tahsildar', 'revenue_staff'), async (req, res, next) => {
  try {
    const { verificationStatus } = req.body;
    const Application = require('../models/Application');

    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    // ENFORCE LOCKING: Check if user is assigned to the related application
    if (doc.relatedApplication) {
      const app = await Application.findById(doc.relatedApplication);
      const isAssigned = app && app.assignedTo && app.assignedTo.toString() === req.user._id.toString();
      if (!isAssigned && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'You are not assigned to the application associated with this document.' });
      }
    }

    doc.verificationStatus = verificationStatus;
    doc.verifiedBy = req.user._id;
    doc.verifiedAt = new Date();
    await doc.save();

    await AuditLog.create({
      user: req.user._id, userName: req.user.fullName, userRole: req.user.role,
      action: `Document ${verificationStatus}`, module: 'document',
      entityId: doc._id.toString(),
      details: `${doc.documentType} verified as ${verificationStatus}`,
      ipAddress: req.ip
    });
    res.json({ success: true, message: `Document marked as ${verificationStatus}.`, data: doc });
  } catch (err) { next(err); }
});

// Delete document (Undo upload)
router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    // Ensure the document is not already processed/verified or linked to a submitted application
    if (doc.verificationStatus !== 'pending' && req.user.role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete a verified document.' });
    }

    if (doc.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this document.' });
    }

    // Remove file from filesystem
    const fullPath = path.join(__dirname, '..', doc.filePath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (err) {
        console.error('Failed to delete file:', err);
      }
    }

    await Document.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      user: req.user._id, userName: req.user.fullName, userRole: req.user.role,
      action: 'Document Deletion', module: 'document',
      details: `Deleted ${doc.documentType}: ${doc.originalName}`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Document deleted successfully.' });
  } catch (err) { next(err); }
});

module.exports = router;
