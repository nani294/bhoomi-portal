// routes/audit.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { AuditLog } = require('../models/index');

router.use(protect, authorize('admin', 'registrar'));
router.get('/', async (req, res, next) => {
  try {
    const { module, action, userId, status, page = 1, limit = 50 } = req.query;
    const query = {};
    if (module) query.module = module;
    if (action) query.action = { $regex: action, $options: 'i' };
    if (userId) query.user = userId;
    if (status) query.status = status;
    const logs = await AuditLog.find(query).sort({ createdAt: -1 }).skip((page-1)*limit).limit(Number(limit));
    const total = await AuditLog.countDocuments(query);
    res.json({ success: true, data: logs, pagination: { total, page: Number(page), pages: Math.ceil(total/limit) } });
  } catch (err) { next(err); }
});
module.exports = router;
