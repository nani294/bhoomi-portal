const mongoose = require('mongoose');

const timelineEventSchema = new mongoose.Schema({
  stage: String,
  status: { type: String, enum: ['completed', 'active', 'pending', 'rejected'] },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  performedByName: String,
  remarks: String,
  timestamp: { type: Date, default: Date.now }
});

const applicationSchema = new mongoose.Schema({
  applicationId: { type: String },
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  applicantName: String,
  applicantContact: String,
  landRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'LandRecord' },
  surveyNumber: String,
  applicationType: {
    type: String,
    enum: [
      'mutation',
      'land_verification',
      'encumbrance_certificate',
      'new_pattadar_passbook',
      'duplicate_pattadar_passbook',
      'passbook_correction',
      'possession_certificate',
      'survey_boundary_verification'
    ],
    required: true
  },
  priority: { type: String, enum: ['normal', 'urgent', 'high'], default: 'normal' },
  status: {
    type: String,
    enum: [
      'submitted',
      'under_verification',
      'pending_documents',
      'survey_assigned',
      'field_inspection',
      'survey_completed',
      'pending_tahsildar_approval',
      'approved',
      'rejected',
      'certificate_generated',
      'passbook_generated'
    ],
    default: 'submitted'
  },
  // Common Fields
  aadhaarNumber: { type: String, required: true },
  subDivisionNumber: String,
  district: String,
  mandal: String,
  village: String,
  extent: String,
  
  // Service Specific Fields
  mutationDetails: {
    transferType: { type: String, enum: ['sale', 'gift', 'inheritance', 'partition'] },
    previousOwnerName: String,
    newOwnerName: String,
    registrationDocNumber: String,
    registrationDate: Date
  },
  ecDetails: {
    periodFrom: Date,
    periodTo: Date,
    purpose: String
  },
  passbookDetails: {
    reasonForRequest: String,
    existingPassbookNumber: String,
    correctionType: String,
    existingValue: String,
    correctValue: String
  },
  possessionDetails: String,
  surveyDetails: {
    natureOfIssue: String,
    boundaryDescription: String,
    surveyReport: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    surveyDate: Date
  },

  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedOfficer: String,
  assignedRole: String,
  assignmentAt: Date,
  assignmentHistory: [{
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedRole: String,
    assignedAt: { type: Date, default: Date.now },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remarks: String
  }],
  documents: {
    aadhaarCard: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    saleDeed: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    passbook: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    deathCertificate: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    legalHeirCertificate: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    ownershipDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    firCopy: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    supportingDocument: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' }
  },
  timeline: [timelineEventSchema],
  reviewNotes: String,
  rejectionReason: String,
  inspectionDate: Date,
  expectedCompletionDate: Date,
  completedDate: Date,
  certificateDetails: {
    certificateNumber: String,
    verificationCode: String,
    issueDate: Date,
    issuingOfficer: String,
    pdfPath: String
  },
  fees: {
    amount: { type: Number, default: 0 },
    paid: { type: Boolean, default: false },
    paymentId: String,
    paidDate: Date
  },
  fraudScore: { type: Number, default: 0 },
  isFlagged: { type: Boolean, default: false },
  flagReasons: [String]
}, { timestamps: true });

// Auto-generate applicationId
applicationSchema.pre('save', async function(next) {
  if (!this.applicationId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('Application').countDocuments();
    this.applicationId = `APP-${year}-${String(count + 4001).padStart(5, '0')}`;
  }
  next();
});

// Single index definitions only — no duplicates
applicationSchema.index({ applicationId: 1 }, { unique: true, sparse: true });
applicationSchema.index({ applicant: 1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Application', applicationSchema);
