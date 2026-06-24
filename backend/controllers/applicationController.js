const Application = require('../models/Application');
const LandRecord = require('../models/LandRecord');
const { Notification, AuditLog } = require('../models/index');
const User = require('../models/User');

// Centralized Workflow Constants
const ROLES = {
  CITIZEN: 'citizen',
  VERIFIER: 'verification_officer',
  SURVEYOR: 'surveyor',
  REVENUE: 'revenue_staff',
  TAHSILDAR: 'tahsildar',
  REGISTRAR: 'registrar',
  ADMIN: 'admin'
};

const SURVEY_REQUIRED_TYPES = [
  'mutation',
  'survey_boundary_verification',
  'land_verification',
  'possession_certificate'
];

// WORKFLOW STATE MACHINE DEFINITION
const WORKFLOW_MAP = {
  submitted: {
    next: ['under_verification', 'rejected'],
    allowedRoles: [ROLES.VERIFIER, ROLES.ADMIN]
  },
  under_verification: {
    next: ['pending_documents', 'verified', 'rejected'],
    allowedRoles: [ROLES.VERIFIER, ROLES.ADMIN]
  },
  pending_documents: {
    next: ['under_verification', 'rejected'],
    allowedRoles: [ROLES.VERIFIER, ROLES.ADMIN]
  },
  survey_assigned: {
    next: ['field_inspection', 'rejected'],
    allowedRoles: [ROLES.SURVEYOR, ROLES.ADMIN]
  },
  field_inspection: {
    next: ['survey_completed', 'rejected'],
    allowedRoles: [ROLES.SURVEYOR, ROLES.ADMIN]
  },
  survey_completed: {
    next: ['under_review', 'rejected'],
    allowedRoles: [ROLES.VERIFIER, ROLES.REVENUE, ROLES.ADMIN]
  },
  under_review: {
    next: ['pending_tahsildar_approval', 'rejected'],
    allowedRoles: [ROLES.REVENUE, ROLES.ADMIN]
  },
  pending_tahsildar_approval: {
    next: ['approved', 'rejected'],
    allowedRoles: [ROLES.TAHSILDAR, ROLES.ADMIN]
  },
  approved: {
    next: ['certificate_generated', 'passbook_generated'],
    allowedRoles: [ROLES.TAHSILDAR, ROLES.ADMIN]
  }
};

// Helper: Auto-assignment Engine (Workload-based)
const autoAssign = async (app, targetRole, assignedBy = null, reason = 'System auto-assignment') => {
  try {
    // 1. Find all active officers for this role in the same district/mandal
    let officers = await User.find({ 
      role: targetRole, 
      isActive: true,
      ...(app.district ? { district: app.district } : {})
    });

    // Fallback: search role-wide if no local officer found
    if (officers.length === 0) {
      officers = await User.find({ role: targetRole, isActive: true });
    }

    if (officers.length === 0) {
      console.warn(`No eligible officers found for role: ${targetRole}`);
      return null;
    }

    // 2. Workload Analysis: Count active applications for each officer
    const workloadCounts = await Application.aggregate([
      { $match: { assignedTo: { $in: officers.map(o => o._id) }, status: { $nin: ['approved', 'rejected'] } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } }
    ]);

    const workloadMap = {};
    workloadCounts.forEach(w => { workloadMap[w._id.toString()] = w.count; });

    // 3. Select officer with the lowest workload
    officers.sort((a, b) => (workloadMap[a._id.toString()] || 0) - (workloadMap[b._id.toString()] || 0));
    const selectedOfficer = officers[0];

    // 4. Perform Assignment
    app.assignedTo = selectedOfficer._id;
    app.assignedOfficer = selectedOfficer.fullName;
    app.assignedRole = targetRole;
    app.assignmentAt = new Date();
    app.assignmentHistory.push({
      assignedTo: selectedOfficer._id,
      assignedRole: targetRole,
      assignedBy: assignedBy?._id,
      remarks: reason
    });

    app.timeline.push({
      stage: 'Workload Assignment',
      status: 'completed',
      performedByName: 'System Engine',
      remarks: `Application routed to ${selectedOfficer.fullName} (${targetRole})`,
      timestamp: new Date()
    });

    // Notify Officer
    await Notification.create({
      recipient: selectedOfficer._id,
      title: 'New Application Assigned',
      message: `Application ${app.applicationId} has been assigned to you for ${targetRole} processing.`,
      type: 'application_update',
      priority: app.priority === 'urgent' ? 'high' : 'normal',
      relatedApplication: app._id
    });

    return selectedOfficer;
  } catch (err) {
    console.error('Auto-assignment failed:', err);
    return null;
  }
};

const logAudit = async (user, action, details, entityId, req) => {
  try {
    await AuditLog.create({
      user: user?._id, userName: user?.fullName, userRole: user?.role,
      action, module: 'application', entityType: 'Application', entityId,
      details, ipAddress: req.ip, userAgent: req.headers['user-agent']
    });
  } catch (e) {}
};

const sendNotification = async (recipient, title, message, type, relatedApp) => {
  try {
    await Notification.create({ recipient, title, message, type, relatedApplication: relatedApp });
  } catch (e) {}
};

// POST /api/applications
exports.createApplication = async (req, res, next) => {
  try {
    const { 
      surveyNumber, applicationType, priority, remarks,
      aadhaarNumber, subDivisionNumber, district, mandal, village, extent,
      mutationDetails, ecDetails, passbookDetails, possessionDetails, surveyDetails,
      documentIds 
    } = req.body;

    // Aadhaar and Mobile validation (Mobile is in req.user.phone)
    if (!aadhaarNumber || aadhaarNumber.length !== 12) {
      return res.status(400).json({ success: false, message: 'A valid 12-digit Aadhaar number is required.' });
    }

    let landRecord = null;
    if (surveyNumber) {
      landRecord = await LandRecord.findOne({ surveyNumber: surveyNumber.toUpperCase() });
    }

    // --- FRAUD DETECTION ENGINE (PHASE 1) ---
    let fraudScore = 0;
    const flagReasons = [];

    // 1. Duplicate Application Check
    if (surveyNumber) {
      const activeStatuses = ['submitted', 'under_verification', 'survey_assigned', 'field_inspection', 'survey_completed', 'pending_tahsildar_approval'];
      const existingApp = await Application.findOne({
        surveyNumber: surveyNumber.toUpperCase(),
        applicationType,
        status: { $in: activeStatuses }
      });
      if (existingApp) {
        fraudScore += 30;
        flagReasons.push('Duplicate Application');
      }
    }

    // 2. Ownership Conflict Check
    if (landRecord) {
      const applicantName = req.user.fullName.toLowerCase().trim();
      const ownerName = landRecord.currentOwner.name.toLowerCase().trim();
      const applicantAadhaar = req.user.aadhaarNumber;
      const ownerAadhaar = landRecord.currentOwner.aadhaarNumber;

      let conflict = false;
      if (ownerAadhaar && applicantAadhaar !== ownerAadhaar) conflict = true;
      else if (!ownerAadhaar && applicantName !== ownerName) conflict = true;

      if (conflict) {
        fraudScore += 40;
        flagReasons.push('Ownership Conflict');
      }
    }

    // 3. Mandatory Documents Check
    if (!documentIds || Object.keys(documentIds).length === 0) {
      fraudScore += 10;
      flagReasons.push('Missing Mandatory Documents');
    }

    const application = await Application.create({
      applicant: req.user._id,
      applicantName: req.user.fullName,
      applicantContact: req.user.phone,
      aadhaarNumber,
      surveyNumber: surveyNumber?.toUpperCase(),
      subDivisionNumber,
      district,
      mandal,
      village,
      extent,
      landRecord: landRecord?._id,
      applicationType,
      priority: priority || 'normal',
      status: 'submitted',
      mutationDetails,
      ecDetails,
      passbookDetails,
      possessionDetails,
      surveyDetails,
      documents: documentIds || {},
      fraudScore,
      isFlagged: fraudScore > 0,
      flagReasons,
      timeline: [{
        stage: 'Application Submitted',
        status: 'completed',
        performedByName: req.user.fullName,
        performedBy: req.user._id,
        remarks: fraudScore > 0 
          ? `Application submitted with ${fraudScore}% risk score. System flagged: ${flagReasons.join(', ')}`
          : 'Application successfully submitted via citizen portal',
        timestamp: new Date()
      }],
      expectedCompletionDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
    });

    // Auto-assign to Verification Officer
    await autoAssign(application, ROLES.VERIFIER, null, 'Initial submission routing');
    await application.save(); // Persist assignment to DB

    // Log Fraud Event if flagged
    if (fraudScore > 0) {
      await AuditLog.create({
        user: req.user._id, userName: req.user.fullName, userRole: req.user.role,
        action: 'Fraud Detected', module: 'application', entityType: 'Application', entityId: application._id,
        details: `Automated detection: Score ${fraudScore}, Reasons: ${flagReasons.join(', ')}`,
        ipAddress: req.ip, status: 'warning'
      });
    }

    // Update documents with application ID
    if (documentIds && Object.keys(documentIds).length > 0) {
      const { Document } = require('../models/index');
      const ids = Object.values(documentIds).filter(id => !!id);
      await Document.updateMany(
        { _id: { $in: ids } },
        { relatedApplication: application._id }
      );
    }

    await logAudit(req.user, 'Create Application', `App ${application.applicationId} for ${applicationType}`, application._id, req);
    await sendNotification(req.user._id, 'Application Submitted', `Your application ${application.applicationId} has been submitted successfully.`, 'application_update', application._id);

    res.status(201).json({ success: true, message: 'Application submitted successfully.', data: application });
  } catch (err) { next(err); }
};

// GET /api/applications
exports.getApplications = async (req, res, next) => {
  try {
    const { status, applicationType, assignedTo, isFlagged, page = 1, limit = 10, search } = req.query;
    const query = {};

    // Citizens only see their own applications
    if (req.user.role === 'citizen') {
      query.applicant = req.user._id;
    } 
    // REGIONAL ENFORCEMENT: Restrict to user's district for officials
    // Only tahsildar and revenue_staff are mandal-scoped; verifiers/surveyors see whole district
    else if (req.user.role !== 'admin' && req.user.district) {
      query.district = req.user.district;
      const mandalScopedRoles = ['tahsildar', 'revenue_staff'];
      if (req.user.mandal && mandalScopedRoles.includes(req.user.role)) {
        query.mandal = req.user.mandal;
      }
    }

    if (status) query.status = status;
    if (applicationType) query.applicationType = applicationType;
    if (assignedTo && assignedTo !== 'undefined') query.assignedTo = assignedTo;
    if (isFlagged !== undefined) query.isFlagged = isFlagged === 'true';
    if (search) {
      query.$or = [
        { applicationId: { $regex: search, $options: 'i' } },
        { applicantName: { $regex: search, $options: 'i' } },
        { surveyNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [apps, total] = await Promise.all([
      Application.find(query)
        .skip(skip).limit(Number(limit))
        .sort({ createdAt: -1 })
        .populate('applicant', 'fullName email phone')
        .populate('assignedTo', 'fullName designation')
        .populate('landRecord', 'surveyNumber district mandal'),
      Application.countDocuments(query)
    ]);

    res.json({ success: true, data: apps, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
};

// Helper: Regional Boundary Enforcement
const checkJurisdiction = async (req, record) => {
  if (req.user.role === 'admin' || req.user.role === 'citizen') return true;
  if (!req.user.district || !record.district) return true; // Failsafe
  
  if (req.user.district !== record.district) {
    await logAudit(req.user, 'Unauthorized District Access Attempt', `User from ${req.user.district} tried to access application in ${record.district}`, record._id, req);
    return false;
  }
  // Only tahsildar and revenue_staff are mandal-scoped; verifiers/surveyors work district-wide
  const mandalScopedRoles = ['tahsildar', 'revenue_staff'];
  if (mandalScopedRoles.includes(req.user.role) && req.user.mandal && record.mandal && req.user.mandal !== record.mandal) {
    await logAudit(req.user, 'Unauthorized Mandal Access Attempt', `User from ${req.user.mandal} tried to access application in ${record.mandal}`, record._id, req);
    return false;
  }
  return true;
};

// GET /api/applications/:id
exports.getApplication = async (req, res, next) => {
  try {
    const app = await Application.findById(req.params.id)
      .populate('applicant', 'fullName email phone aadhaarNumber')
      .populate('assignedTo', 'fullName designation district')
      .populate('landRecord')
      .populate('documents.aadhaarCard')
      .populate('documents.saleDeed')
      .populate('documents.passbook')
      .populate('documents.deathCertificate')
      .populate('documents.legalHeirCertificate')
      .populate('documents.ownershipDocument')
      .populate('documents.firCopy')
      .populate('documents.supportingDocument');

    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });
    if (req.user.role === 'citizen' && app.applicant._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    if (!(await checkJurisdiction(req, app))) {
      return res.status(403).json({ success: false, message: 'Access denied: Application is outside your jurisdiction.' });
    }

    res.json({ success: true, data: app });
  } catch (err) { next(err); }
};

// PATCH /api/applications/:id/status
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, remarks, rejectionReason, assignedTo, surveyReportId } = req.body;
    
    const app = await Application.findById(req.params.id)
      .populate('applicant', '_id')
      .populate('assignedTo', '_id role');
      
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

    const userRole = req.user.role;
    const currentStatus = app.status;

    // 1. ASSIGNMENT & ADMIN ENFORCEMENT
    const isAssigned = app.assignedTo && app.assignedTo._id.toString() === req.user._id.toString();
    const isAdmin = userRole === ROLES.ADMIN;

    if (!isAssigned && !isAdmin) {
      await logAudit(req.user, 'Unauthorized Modification Attempt', `User tried to update status of unassigned app ${app.applicationId}`, app._id, req);
      return res.status(403).json({ 
        success: false, 
        message: `Application is locked. You must be the assigned officer or an administrator to modify it.` 
      });
    }

    // 2. STATE MACHINE VALIDATION
    const config = WORKFLOW_MAP[currentStatus];
    if (!config) {
      return res.status(400).json({ success: false, message: `Application is in an invalid or terminal state: ${currentStatus}` });
    }

    // Check if transition is allowed
    if (!config.next.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: `Invalid workflow transition: Cannot move from '${currentStatus}' to '${status}'.` 
      });
    }

    // Check if role is allowed to perform this transition
    if (!config.allowedRoles.includes(userRole) && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: `Your role (${userRole}) is not authorized to transition applications from '${currentStatus}'.` 
      });
    }

    // 3. SPECIAL STAGE VALIDATIONS
    
    // Surveyor Requirements
    if (status === 'survey_completed' && !surveyReportId) {
      return res.status(400).json({ success: false, message: 'A Survey Report is mandatory to complete this stage.' });
    }

    // Tahsildar Approval Requirements
    if (['approved', 'certificate_generated', 'passbook_generated'].includes(status)) {
      const { Document } = require('../models/index');
      const docs = await Document.find({ relatedApplication: app._id });
      
      // Ensure documents exist and are verified
      if (docs.length === 0) return res.status(400).json({ success: false, message: 'Approval blocked: No documents found.' });
      
      const unverified = docs.filter(d => d.verificationStatus !== 'verified');
      if (unverified.length > 0) {
        return res.status(400).json({ success: false, message: `Approval blocked: ${unverified.length} document(s) are not verified.` });
      }

      // Check for Critical Fraud Flags
      if (app.isFlagged && app.fraudScore >= 60) {
        return res.status(400).json({ 
          success: false, 
          message: 'Approval blocked: Application has High-Risk fraud flags that must be resolved or cleared first.' 
        });
      }
    }

    // 4. EXECUTE ROUTING & ASSIGNMENT
    let nextStatus = status;

    // Handle Admin Reassignment
    if (isAdmin && assignedTo && assignedTo !== app.assignedTo?._id?.toString()) {
      const newOfficer = await User.findById(assignedTo);
      if (newOfficer) {
        app.assignedTo = newOfficer._id;
        app.assignedOfficer = newOfficer.fullName;
        app.assignedRole = newOfficer.role;
        app.assignmentHistory.push({
          assignedTo: newOfficer._id,
          assignedRole: newOfficer.role,
          assignedBy: req.user._id,
          remarks: 'Manual Administrator Reassignment'
        });
      }
    }

    // Automated Internal Routing Logic
    if (status === 'verified') {
      const needsSurvey = SURVEY_REQUIRED_TYPES.includes(app.applicationType);
      nextStatus = needsSurvey ? 'survey_assigned' : 'under_review';
      const targetRole = needsSurvey ? ROLES.SURVEYOR : ROLES.REVENUE;
      await autoAssign(app, targetRole, req.user, `Verified by ${userRole}. Routing to ${targetRole}.`);
    } 
    else if (status === 'survey_completed') {
      nextStatus = 'under_review';
      await autoAssign(app, ROLES.REVENUE, req.user, 'Survey completed. Routing to Revenue Review.');
    }
    else if (status === 'pending_tahsildar_approval') {
      await autoAssign(app, ROLES.TAHSILDAR, req.user, 'Revenue review completed. Routing to Tahsildar.');
    }

    // 5. UPDATE AND PERSIST
    app.status = nextStatus;
    if (remarks) app.reviewNotes = remarks;
    if (rejectionReason) app.rejectionReason = rejectionReason;
    if (surveyReportId) {
      app.surveyDetails.surveyReport = surveyReportId;
      app.surveyDetails.surveyDate = new Date();
    }
    
    if (['approved', 'certificate_generated', 'passbook_generated'].includes(nextStatus)) {
      app.completedDate = new Date();
      if (['certificate_generated', 'passbook_generated'].includes(nextStatus)) {
        const { generatePDF } = require('../utils/pdfGenerator');
        try {
          app.certificateDetails = await generatePDF(app, req.user.fullName, nextStatus === 'passbook_generated');
        } catch (err) { console.error("PDF Fail:", err); }
      }
    }

    app.timeline.push({
      stage: nextStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      status: nextStatus === 'rejected' ? 'rejected' : 'completed',
      performedBy: req.user._id,
      performedByName: req.user.fullName,
      remarks: remarks || `Transitioned to ${nextStatus} by ${userRole}`,
      timestamp: new Date()
    });

    await app.save();
    await logAudit(req.user, 'Status Update', `${app.applicationId}: ${currentStatus} -> ${nextStatus}`, app._id, req);

    // Notifications
    const notifMap = {
      approved: 'Approved', rejected: 'Rejected', certificate_generated: 'Certificate Ready',
      under_verification: 'Under Verification', survey_assigned: 'Survey Assigned', pending_documents: 'Action Required'
    };
    if (notifMap[nextStatus]) {
      await sendNotification(app.applicant._id, 'Application Update', `Status: ${notifMap[nextStatus]}`, 'application_update', app._id);
    }

    res.json({ success: true, message: `Application moved to ${nextStatus}`, data: app });
  } catch (err) { next(err); }
};

// PATCH /api/applications/:id/flag
exports.flagApplication = async (req, res, next) => {
  try {
    const { isFlagged, flagReasons } = req.body;
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

    // Lock Check
    const isAssigned = app.assignedTo && app.assignedTo.toString() === req.user._id.toString();
    if (!isAssigned && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Application is locked. Only the assigned officer or an admin can flag it.' });
    }

    const manualFlagReason = 'Manual Officer Flag';
    let currentFlagReasons = app.flagReasons || [];
    let newScore = app.fraudScore || 0;

    const hadManualFlag = currentFlagReasons.includes(manualFlagReason);

    if (isFlagged && !hadManualFlag) {
      newScore += 20;
      currentFlagReasons.push(manualFlagReason);
    } else if (!isFlagged && hadManualFlag) {
      newScore = Math.max(0, newScore - 20);
      currentFlagReasons = currentFlagReasons.filter(r => r !== manualFlagReason);
    }

    // If an officer provides specific reasons, we can append them (excluding duplicates)
    if (isFlagged && flagReasons && Array.isArray(flagReasons)) {
      flagReasons.forEach(r => {
        if (r !== manualFlagReason && !currentFlagReasons.includes(r)) {
          currentFlagReasons.push(r);
        }
      });
    }

    app.isFlagged = currentFlagReasons.length > 0;
    app.flagReasons = currentFlagReasons;
    app.fraudScore = newScore;
    await app.save();

    await logAudit(req.user, isFlagged ? 'Flag Application' : 'Unflag Application', `${app.applicationId} risk score: ${newScore}`, app._id, req);
    res.json({ success: true, message: `Application ${isFlagged ? 'flagged' : 'unflagged'}.`, data: app });
  } catch (err) { next(err); }
};

const path = require('path');
const fs = require('fs');

// Ensure certificates directory exists
const certDir = path.join(__dirname, '../uploads/certificates');
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
}

// GET /api/applications/:id/download-certificate
exports.downloadCertificate = async (req, res, next) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

    // 1. Authorization Rules
    const isOwner = app.applicant.toString() === req.user._id.toString();
    const isAdmin = req.user.role === ROLES.ADMIN;
    
    // Only owner or admin can download
    if (!isOwner && !isAdmin) {
      await logAudit(req.user, 'Unauthorized Download Attempt', `User tried to download cert for app ${app.applicationId}`, app._id, req);
      return res.status(403).json({ success: false, message: 'You are not authorized to download this certificate.' });
    }

    if (!app.certificateDetails || !app.certificateDetails.pdfPath) {
      return res.status(404).json({ success: false, message: 'Certificate has not been generated for this application.' });
    }

    const fullPath = path.join(__dirname, '..', app.certificateDetails.pdfPath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, message: 'Certificate file not found on server.' });
    }

    // 2. Log Download
    await logAudit(req.user, 'Certificate Download', `Downloaded certificate: ${app.certificateDetails.certificateNumber}`, app._id, req);

    // 3. Serve File
    res.download(fullPath, `${app.certificateDetails.certificateNumber}.pdf`);
  } catch (err) { next(err); }
};

// GET /api/applications/stats
exports.getStats = async (req, res, next) => {
  try {
    const query = {};
    const role = req.user.role;
    
    // Citizens only see their own
    if (role === 'citizen') {
      query.applicant = req.user._id;
    } 
    // Officials only see their district; only tahsildar/revenue_staff are mandal-scoped
    else if (role !== 'admin' && req.user.district) {
      query.district = req.user.district;
      const mandalScopedRoles = ['tahsildar', 'revenue_staff'];
      if (req.user.mandal && mandalScopedRoles.includes(role)) {
        query.mandal = req.user.mandal;
      }
    }

    const [total, submitted, under_review, approved, rejected, flagged, byType] = await Promise.all([
      Application.countDocuments(query),
      Application.countDocuments({ ...query, status: 'submitted' }),
      Application.countDocuments({ ...query, status: 'under_review' }),
      Application.countDocuments({ ...query, status: { $in: ['approved', 'certificate_generated', 'passbook_generated'] } }),
      Application.countDocuments({ ...query, status: 'rejected' }),
      Application.countDocuments({ ...query, isFlagged: true }),
      Application.aggregate([
        ...(Object.keys(query).length ? [{ $match: query }] : []),
        { $group: { _id: '$applicationType', count: { $sum: 1 } } }
      ])
    ]);

    // Role-specific metrics for officials
    let roleSpecific = {};
    if (role === ROLES.SURVEYOR) {
      roleSpecific = {
        total: await Application.countDocuments({ assignedTo: req.user._id }),
        submitted: await Application.countDocuments({ assignedTo: req.user._id, status: { $in: ['survey_assigned', 'field_inspection'] } }),
        approved: await Application.countDocuments({ assignedTo: req.user._id, status: 'survey_completed' })
      };
    } else if (role === ROLES.TAHSILDAR) {
      roleSpecific = {
        submitted: await Application.countDocuments({ assignedTo: req.user._id, status: 'pending_tahsildar_approval' })
      };
    } else if (role === ROLES.VERIFIER || role === ROLES.REVENUE) {
      roleSpecific = {
        submitted: await Application.countDocuments({ assignedTo: req.user._id, status: { $in: ['submitted', 'under_verification', 'under_review'] } })
      };
    }

    // Merge roleSpecific if any (only override for the specific user's dashboard view if needed)
    // Actually, the frontend expects a flat object, so we can selectively override
    const data = { total, submitted, under_review, approved, rejected, flagged, byType };
    if (Object.keys(roleSpecific).length > 0) {
      Object.assign(data, roleSpecific);
    }

    res.json({ success: true, data });
  } catch (err) { next(err); }
};
