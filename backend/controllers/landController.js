const LandRecord = require('../models/LandRecord');
const { AuditLog } = require('../models/index');

const logAudit = async (user, action, details, entityId, req) => {
  try {
    await AuditLog.create({
      user: user?._id, userName: user?.fullName, userRole: user?.role,
      action, module: 'land', entityType: 'LandRecord', entityId,
      details, ipAddress: req.ip, userAgent: req.headers['user-agent']
    });
  } catch (e) {}
};

// Helper: Regional Boundary Enforcement
const checkJurisdiction = async (req, record) => {
  if (req.user.role === 'admin' || req.user.role === 'citizen') return true;
  if (!req.user.district || !record.district) return true; // Failsafe if data is incomplete
  
  if (req.user.district !== record.district) {
    await logAudit(req.user, 'Unauthorized District Access Attempt', `User from ${req.user.district} tried to access record in ${record.district}`, record._id, req);
    return false;
  }

  // Enforce Mandal if user has a specific mandal assigned
  if (req.user.mandal && record.mandal && req.user.mandal !== record.mandal) {
    await logAudit(req.user, 'Unauthorized Mandal Access Attempt', `User from ${req.user.mandal} tried to access record in ${record.mandal}`, record._id, req);
    return false;
  }

  return true;
};

// GET /api/land - search and list
exports.getLandRecords = async (req, res, next) => {
  try {
    const { search, district, mandal, village, landType, status, verificationStatus, page = 1, limit = 10 } = req.query;
    const query = {};

    // REGIONAL ENFORCEMENT: Restrict list to user's district if official
    if (req.user.role !== 'admin' && req.user.role !== 'citizen' && req.user.district) {
      query.district = req.user.district;
      if (req.user.mandal) query.mandal = req.user.mandal;
    } else {
      if (district) query.district = district;
      if (mandal) query.mandal = mandal;
    }

    if (search) {
      query.$or = [
        { surveyNumber: { $regex: search, $options: 'i' } },
        { registrationId: { $regex: search, $options: 'i' } },
        { 'currentOwner.name': { $regex: search, $options: 'i' } },
        { pattaNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (village) query.village = { $regex: village, $options: 'i' };
    if (landType) query.landType = landType;
    if (status) query.status = status;
    if (verificationStatus) query.verificationStatus = verificationStatus;

    const skip = (page - 1) * limit;
    const [records, total] = await Promise.all([
      LandRecord.find(query).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }).populate('lastVerifiedBy', 'fullName'),
      LandRecord.countDocuments(query)
    ]);

    await logAudit(req.user, 'Search Land Records', `Query: ${search || 'all'}`, null, req);

    res.json({
      success: true,
      data: records,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit), limit: Number(limit) }
    });
  } catch (err) { next(err); }
};

// GET /api/land/:id
exports.getLandRecord = async (req, res, next) => {
  try {
    const record = await LandRecord.findById(req.params.id)
      .populate('documents')
      .populate('lastVerifiedBy', 'fullName designation');
    if (!record) return res.status(404).json({ success: false, message: 'Land record not found.' });
    
    if (!(await checkJurisdiction(req, record))) {
      return res.status(403).json({ success: false, message: 'Access denied: Record is outside your jurisdiction.' });
    }

    await logAudit(req.user, 'View Land Record', `Viewed ${record.surveyNumber}`, record._id, req);
    res.json({ success: true, data: record });
  } catch (err) { next(err); }
};

// GET /api/land/survey/:surveyNumber
exports.getBySurveyNumber = async (req, res, next) => {
  try {
    const record = await LandRecord.findOne({ surveyNumber: req.params.surveyNumber.toUpperCase() })
      .populate('documents')
      .populate('lastVerifiedBy', 'fullName designation');
    if (!record) return res.status(404).json({ success: false, message: 'No record found for this survey number.' });
    
    if (!(await checkJurisdiction(req, record))) {
      return res.status(403).json({ success: false, message: 'Access denied: Record is outside your jurisdiction.' });
    }

    res.json({ success: true, data: record });
  } catch (err) { next(err); }
};

// POST /api/land (admin/registrar/revenue_staff)
exports.createLandRecord = async (req, res, next) => {
  try {
    // ENFORCE REGION ON CREATION
    if (req.user.role !== 'admin') {
      if (req.user.district && req.body.district !== req.user.district) {
        return res.status(403).json({ success: false, message: 'You can only create records within your assigned district.' });
      }
    }

    const record = await LandRecord.create({ ...req.body });
    await logAudit(req.user, 'Create Land Record', `Created ${record.surveyNumber}`, record._id, req);
    res.status(201).json({ success: true, message: 'Land record created successfully.', data: record });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Survey number or registration ID already exists.' });
    next(err);
  }
};

// PUT /api/land/:id
exports.updateLandRecord = async (req, res, next) => {
  try {
    const recordToUpdate = await LandRecord.findById(req.params.id);
    if (!recordToUpdate) return res.status(404).json({ success: false, message: 'Land record not found.' });

    if (!(await checkJurisdiction(req, recordToUpdate))) {
      return res.status(403).json({ success: false, message: 'Access denied: Cannot modify records outside your jurisdiction.' });
    }

    const record = await LandRecord.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    await logAudit(req.user, 'Update Land Record', `Updated ${record.surveyNumber}`, record._id, req);
    res.json({ success: true, message: 'Record updated.', data: record });
  } catch (err) { next(err); }
};

// PATCH /api/land/:id/verify
exports.verifyLandRecord = async (req, res, next) => {
  try {
    const { verificationStatus, remarks } = req.body;
    const recordToVerify = await LandRecord.findById(req.params.id);
    if (!recordToVerify) return res.status(404).json({ success: false, message: 'Land record not found.' });

    if (!(await checkJurisdiction(req, recordToVerify))) {
      return res.status(403).json({ success: false, message: 'Access denied: Cannot verify records outside your jurisdiction.' });
    }

    const record = await LandRecord.findByIdAndUpdate(req.params.id, {
      verificationStatus,
      lastVerifiedDate: new Date(),
      lastVerifiedBy: req.user._id,
      remarks
    }, { new: true });
    
    await logAudit(req.user, 'Verify Land Record', `Status: ${verificationStatus} for ${record.surveyNumber}`, record._id, req);
    res.json({ success: true, message: `Record marked as ${verificationStatus}.`, data: record });
  } catch (err) { next(err); }
};

// GET /api/land/stats/overview
exports.getStats = async (req, res, next) => {
  try {
    const query = {};
    if (req.user.role !== 'admin' && req.user.role !== 'citizen' && req.user.district) {
      query.district = req.user.district;
      if (req.user.mandal) query.mandal = req.user.mandal;
    }

    const [total, verified, pending, disputed, flagged, byType] = await Promise.all([
      LandRecord.countDocuments(query),
      LandRecord.countDocuments({ ...query, verificationStatus: 'verified' }),
      LandRecord.countDocuments({ ...query, verificationStatus: 'pending' }),
      LandRecord.countDocuments({ ...query, status: 'disputed' }),
      LandRecord.countDocuments({ ...query, isFlagged: true }),
      LandRecord.aggregate([
        ...(Object.keys(query).length ? [{ $match: query }] : []),
        { $group: { _id: '$landType', count: { $sum: 1 } } }
      ])
    ]);
    res.json({ success: true, data: { total, verified, pending, disputed, flagged, byType } });
  } catch (err) { next(err); }
};

// GET /api/land/:id/history
exports.getOwnershipHistory = async (req, res, next) => {
  try {
    const record = await LandRecord.findById(req.params.id).select('surveyNumber ownershipHistory currentOwner district mandal');
    if (!record) return res.status(404).json({ success: false, message: 'Land record not found.' });
    
    if (!(await checkJurisdiction(req, record))) {
      return res.status(403).json({ success: false, message: 'Access denied: Record is outside your jurisdiction.' });
    }

    res.json({ success: true, data: { surveyNumber: record.surveyNumber, currentOwner: record.currentOwner, history: record.ownershipHistory } });
  } catch (err) { next(err); }
};
