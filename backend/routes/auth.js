const express = require('express');
const router = express.Router();
const { register, login, getMe, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { body } = require('express-validator');
const User = require('../models/User');

// POST /api/auth/register
router.post('/register', [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('phone').notEmpty().withMessage('Phone number is required')
], register);

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me
router.get('/me', protect, getMe);

// PUT /api/auth/change-password
router.put('/change-password', protect, changePassword);

// POST /api/auth/check-unique — check phone and aadhaar uniqueness
router.post('/check-unique', async (req, res, next) => {
  try {
    const { phone, aadhaarNumber, excludeId } = req.body;
    const query = excludeId ? { _id: { $ne: excludeId } } : {};

    if (phone) {
      const phoneExists = await User.findOne({ ...query, phone });
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          message: 'This phone number is already registered with another account. Please use a different number.'
        });
      }
    }

    if (aadhaarNumber && aadhaarNumber.length === 12) {
      const aadhaarExists = await User.findOne({ ...query, aadhaarNumber });
      if (aadhaarExists) {
        return res.status(400).json({
          success: false,
          message: 'This Aadhaar number is already linked to another account. Please check and try again.'
        });
      }
    }

    res.json({ success: true, message: 'Details are unique.' });
  } catch (err) { next(err); }
});

module.exports = router;
