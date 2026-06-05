const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const { AuditLog } = require('../models/index');

router.use(protect, authorize('admin'));

// GET all users with filters
router.get('/', async (req, res, next) => {
  try {
    const { role, isActive, search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } }
      ];
    }
    const users = await User.find(query)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });
    const total = await User.countDocuments(query);
    res.json({ success: true, data: users, pagination: { total, page: Number(page), pages: Math.ceil(total / limit) } });
  } catch (err) { next(err); }
});

// GET user counts by role
router.get('/counts', async (req, res, next) => {
  try {
    const counts = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    const result = {};
    counts.forEach(c => { result[c._id] = c.count; });
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// POST create new user — admin only, no registrar role
router.post('/', async (req, res, next) => {
  try {
    const { fullName, email, password, phone, role, district, mandal, designation, employeeId, aadhaarNumber } = req.body;

    // Validate required fields
    if (!fullName || !email || !password || !phone || !role) {
      return res.status(400).json({ success: false, message: 'Full name, email, password, phone and role are required.' });
    }

    // Only allow these roles
    const allowedRoles = ['citizen', 'verification_officer', 'surveyor', 'revenue_staff', 'tahsildar', 'registrar', 'admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Allowed: citizen, verification_officer, surveyor, revenue_staff, tahsildar, registrar, admin.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    // Check email uniqueness
    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists.' });
    }

    // Check phone uniqueness
    const phoneExists = await User.findOne({ phone });
    if (phoneExists) {
      return res.status(400).json({ success: false, message: 'This phone number is already registered.' });
    }

    // Check aadhaar uniqueness if provided
    if (aadhaarNumber) {
      const aadhaarExists = await User.findOne({ aadhaarNumber });
      if (aadhaarExists) {
        return res.status(400).json({ success: false, message: 'This Aadhaar number is already linked to another account.' });
      }
    }

    // Check employee ID uniqueness if provided
    if (employeeId) {
      const empExists = await User.findOne({ employeeId });
      if (empExists) {
        return res.status(400).json({ success: false, message: 'Employee ID already assigned to another user.' });
      }
    }

    if (district && mandal) {
      const { data } = require('../utils/geoData');
      if (!data[district] || !data[district].includes(mandal)) {
        return res.status(400).json({ success: false, message: `Invalid Mandal '${mandal}' for District '${district}'.` });
      }
    }

    const user = await User.create({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone: phone.trim(),
      role,
      district: district || undefined,
      mandal: mandal || undefined,
      designation: designation || undefined,
      employeeId: employeeId || undefined,
      aadhaarNumber: aadhaarNumber || undefined,
      isActive: true,
      isEmailVerified: true
    });

    await AuditLog.create({
      user: req.user._id,
      userName: req.user.fullName,
      userRole: req.user.role,
      action: 'Create User',
      module: 'user',
      entityType: 'User',
      entityId: user._id.toString(),
      details: 'Admin created ' + role + ' account for ' + fullName + ' (' + email + ')',
      ipAddress: req.ip,
      status: 'success'
    });

    user.password = undefined;
    res.status(201).json({ success: true, message: role.replace(/_/g, ' ') + ' account created successfully.', data: user });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ success: false, message: 'The ' + field + ' is already registered. Please use a different value.' });
    }
    next(err);
  }
});

// PATCH toggle active/inactive
router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    }
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    await AuditLog.create({
      user: req.user._id, userName: req.user.fullName, userRole: req.user.role,
      action: user.isActive ? 'Activate User' : 'Deactivate User',
      module: 'user', entityId: user._id.toString(),
      details: (user.isActive ? 'Activated' : 'Deactivated') + ' user: ' + user.email,
      ipAddress: req.ip, status: 'success'
    });
    res.json({ success: true, message: 'User ' + (user.isActive ? 'activated' : 'deactivated') + ' successfully.', data: user });
  } catch (err) { next(err); }
});

// PUT update role
router.put('/:id/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    const validRoles = ['citizen', 'verification_officer', 'surveyor', 'revenue_staff', 'tahsildar', 'registrar', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Allowed: citizen, verification_officer, surveyor, revenue_staff, tahsildar, registrar, admin.' });
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    await AuditLog.create({
      user: req.user._id, userName: req.user.fullName, userRole: req.user.role,
      action: 'Change User Role', module: 'user', entityId: user._id.toString(),
      details: 'Changed role of ' + user.email + ' to ' + role,
      ipAddress: req.ip, status: 'success'
    });
    res.json({ success: true, message: 'User role updated successfully.', data: user });
  } catch (err) { next(err); }
});

// PUT update user details
router.put('/:id', async (req, res, next) => {
  try {
    const allowed = ['fullName', 'phone', 'district', 'mandal', 'designation', 'employeeId'];
    const updates = {};
    allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    if (updates.district && updates.mandal) {
      const { data } = require('../utils/geoData');
      if (!data[updates.district] || !data[updates.district].includes(updates.mandal)) {
        return res.status(400).json({ success: false, message: `Invalid Mandal '${updates.mandal}' for District '${updates.district}'.` });
      }
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: 'User updated successfully.', data: user });
  } catch (err) { next(err); }
});

// DELETE user
router.delete('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }
    await User.findByIdAndDelete(req.params.id);
    await AuditLog.create({
      user: req.user._id, userName: req.user.fullName, userRole: req.user.role,
      action: 'Delete User', module: 'user', entityId: req.params.id,
      details: 'Deleted user: ' + user.email + ' (' + user.role + ')',
      ipAddress: req.ip, status: 'success'
    });
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) { next(err); }
});

module.exports = router;
