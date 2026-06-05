// routes/applications.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/applicationController');
const { protect, authorize } = require('../middleware/auth');
const Application = require('../models/Application');

// Public Verification Route
router.get('/verify/:code', async (req, res, next) => {
  try {
    const code = req.params.code.trim();
    // Search by verification code or certificate number
    const app = await Application.findOne({
      $or: [
        { 'certificateDetails.verificationCode': code },
        { 'certificateDetails.certificateNumber': code }
      ]
    }).select('applicationId applicationType status applicantName district mandal village extent certificateDetails completedDate');

    if (!app || !app.certificateDetails) {
      return res.status(404).json({ success: false, message: 'Certificate not found or invalid.' });
    }

    res.json({ success: true, data: app });
  } catch (err) { next(err); }
});

router.use(protect);
router.get('/stats', ctrl.getStats);
router.post('/', ctrl.createApplication);
router.get('/', ctrl.getApplications);
router.get('/:id', ctrl.getApplication);
router.get('/:id/download-certificate', ctrl.downloadCertificate);
router.patch('/:id/status', authorize('admin', 'verification_officer', 'revenue_staff', 'tahsildar', 'surveyor'), ctrl.updateStatus);
router.patch('/:id/flag', authorize('admin', 'verification_officer', 'revenue_staff', 'tahsildar'), ctrl.flagApplication);
module.exports = router;
