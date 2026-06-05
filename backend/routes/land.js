const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/landController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/stats/overview', ctrl.getStats);
router.get('/survey/:surveyNumber', ctrl.getBySurveyNumber);
router.get('/:id/history', ctrl.getOwnershipHistory);
router.get('/', ctrl.getLandRecords);
router.get('/:id', ctrl.getLandRecord);
router.post('/', authorize('admin', 'registrar', 'revenue_staff'), ctrl.createLandRecord);
router.put('/:id', authorize('admin', 'registrar', 'revenue_staff'), ctrl.updateLandRecord);
router.patch('/:id/verify', authorize('admin', 'verification_officer', 'registrar'), ctrl.verifyLandRecord);

module.exports = router;
