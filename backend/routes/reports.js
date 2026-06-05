// routes/reports.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const LandRecord = require('../models/LandRecord');
const Application = require('../models/Application');
const User = require('../models/User');
const { AuditLog } = require('../models/index');

router.use(protect, authorize('admin', 'tahsildar'));

router.get('/overview', async (req, res, next) => {
  try {
    const landQuery = {};
    const appQuery = {};

    // REGIONAL ENFORCEMENT: Restrict reports to user's district for Tahsildars
    if (req.user.role !== 'admin' && req.user.district) {
      landQuery.district = req.user.district;
      appQuery.district = req.user.district;
      if (req.user.mandal) {
        landQuery.mandal = req.user.mandal;
        appQuery.mandal = req.user.mandal;
      }
    }

    const [totalLand, totalApps, totalUsers, pendingApps, fraudAlerts,
      verifiedLand, appsByMonth, landByDistrict] = await Promise.all([
      LandRecord.countDocuments(landQuery),
      Application.countDocuments(appQuery),
      User.countDocuments({ isActive: true, ...(req.user.role !== 'admin' && req.user.district ? { district: req.user.district } : {}) }),
      Application.countDocuments({ ...appQuery, status: { $in: ['submitted', 'under_review'] } }),
      Application.countDocuments({ ...appQuery, isFlagged: true }),
      LandRecord.countDocuments({ ...landQuery, verificationStatus: 'verified' }),
      Application.aggregate([
        ...(Object.keys(appQuery).length ? [{ $match: appQuery }] : []),
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            count: { $sum: 1 }
          }
        }, { $sort: { '_id.year': 1, '_id.month': 1 } }, { $limit: 12 }
      ]),
      LandRecord.aggregate([
        ...(Object.keys(landQuery).length ? [{ $match: landQuery }] : []),
        { $group: { _id: '$district', count: { $sum: 1 }, totalArea: { $sum: '$extent.value' } } }, 
        { $sort: { count: -1 } }, 
        { $limit: 10 }
      ])
    ]);
    res.json({ success: true, data: { totalLand, totalApps, totalUsers, pendingApps, fraudAlerts, verifiedLand, appsByMonth, landByDistrict } });
  } catch (err) { next(err); }
});

module.exports = router;
