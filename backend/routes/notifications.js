// routes/notifications.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { Notification, AuditLog } = require('../models/index');

router.use(protect);

router.get('/', async (req, res, next) => {
  try {
    const notifs = await Notification.find({ recipient: req.user._id }).sort({ createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    res.json({ success: true, data: notifs, unreadCount });
  } catch (err) { next(err); }
});

router.patch('/mark-read', async (req, res, next) => {
  try {
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) { next(err); }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });

    // Authorization Check: Must be the recipient
    if (notification.recipient.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      await AuditLog.create({
        user: req.user._id, userName: req.user.fullName, userRole: req.user.role,
        action: 'Unauthorized Notification Access', module: 'system',
        entityId: req.params.id,
        details: `User tried to modify notification belonging to another user.`,
        ipAddress: req.ip, status: 'warning'
      });
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    notification.isRead = true;
    await notification.save();
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
