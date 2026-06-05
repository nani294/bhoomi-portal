const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { AuditLog } = require('../models/index');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const logAudit = async (user, action, details, req, status = 'success') => {
  try {
    await AuditLog.create({
      user: user?._id,
      userName: user?.fullName,
      userRole: user?.role,
      action,
      module: 'auth',
      details,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      status
    });
  } catch (e) { /* non-critical */ }
};

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { fullName, email, password, phone, aadhaarNumber, role, district, mandal, designation, employeeId } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: 'Email already registered.' });

    const allowedPublicRoles = ['citizen'];
    const finalRole = allowedPublicRoles.includes(role) ? role : 'citizen';

    if (district && mandal) {
      const { data } = require('../utils/geoData');
      if (!data[district] || !data[district].includes(mandal)) {
        return res.status(400).json({ success: false, message: `Invalid Mandal '${mandal}' for District '${district}'.` });
      }
    }

    const user = await User.create({
      fullName, email, password, phone, aadhaarNumber,
      role: finalRole, district, mandal, designation, employeeId,
      status: 'active'
    });

    await logAudit(user, 'User Registration', `New ${finalRole} account created`, req);
    const token = signToken(user._id);
    user.password = undefined;

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: { id: user._id, fullName: user.fullName, email: user.email, role: user.role, district: user.district }
    });
  } catch (err) { next(err); }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password, portalRole } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      await logAudit(null, 'Failed Login', `Failed login attempt for ${email}`, req, 'failure');
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Role Portal Verification
    if (portalRole) {
      if (portalRole === 'citizen' && user.role !== 'citizen') {
        return res.status(403).json({ success: false, message: 'Official accounts cannot log in via the Citizen portal.' });
      }
      if (portalRole === 'official' && ['admin', 'citizen'].includes(user.role)) {
        return res.status(403).json({ success: false, message: 'Invalid portal for this account type.' });
      }
      if (portalRole === 'admin' && user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only Administrators can log in via the Admin portal.' });
      }
    }

    if (!user.isActive) return res.status(401).json({ success: false, message: 'Account is deactivated.' });

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    await logAudit(user, 'User Login', `Login from ${req.ip}`, req);

    const token = signToken(user._id);
    user.password = undefined;

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        district: user.district,
        mandal: user.mandal,
        phone: user.phone,
        designation: user.designation,
        employeeId: user.employeeId,
        lastLogin: user.lastLogin
      }
    });
  } catch (err) { next(err); }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }
    user.password = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();
    await logAudit(user, 'Password Changed', 'User changed their password', req);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) { next(err); }
};
