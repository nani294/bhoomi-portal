const mongoose = require('mongoose');

// Document model
const documentSchema = new mongoose.Schema({
  originalName: { type: String, required: true },
  fileName: { type: String, required: true },
  filePath: { type: String, required: true },
  fileSize: Number,
  mimeType: String,
  documentType: {
    type: String,
    enum: ['pattadar_passbook', 'sale_deed', 'encumbrance_certificate', 'aadhaar', 'id_proof', 'survey_map', 'mutation_deed', 'court_order', 'tax_receipt', 'other'],
    default: 'other'
  },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  relatedApplication: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
  relatedLandRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'LandRecord' },
  ocrStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  ocrData: {
    ownerName: String,
    aadhaarNumber: String,
    surveyNumber: String,
    registrationNumber: String,
    extent: String,
    village: String,
    mandal: String,
    district: String,
    confidence: Number,
    rawText: String
  },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected', 'forged'], default: 'pending' },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  isCertificate: { type: Boolean, default: false }
}, { timestamps: true });

// AuditLog model
const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  userRole: String,
  action: { type: String, required: true },
  module: { type: String, enum: ['auth', 'land', 'application', 'document', 'user', 'report', 'system'] },
  entityType: String,
  entityId: String,
  details: String,
  ipAddress: String,
  userAgent: String,
  status: { type: String, enum: ['success', 'failure', 'warning'], default: 'success' }
}, { timestamps: true });

// Notification model
const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['application_update', 'fraud_alert', 'document_verified', 'certificate_ready', 'system', 'reminder'], default: 'system' },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  isRead: { type: Boolean, default: false },
  relatedApplication: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
  relatedLandRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'LandRecord' },
  actionUrl: String,
  sentViaSMS: { type: Boolean, default: false },
  sentViaEmail: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = {
  Document: mongoose.model('Document', documentSchema),
  AuditLog: mongoose.model('AuditLog', auditLogSchema),
  Notification: mongoose.model('Notification', notificationSchema)
};
