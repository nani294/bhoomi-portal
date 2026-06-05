const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName:        { type: String, required: true, trim: true },
  email:           { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:        { type: String, required: true, minlength: 6, select: false },
  phone:           { type: String },
  aadhaarNumber:   { type: String },
  role: {
    type: String,
    enum: ['citizen', 'verification_officer', 'surveyor', 'revenue_staff', 'tahsildar', 'registrar', 'admin'],
    default: 'citizen'
  },
  district:        { type: String },
  mandal:          { type: String },
  designation:     { type: String },
  employeeId:      { type: String, unique: true, sparse: true },
  isActive:        { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  lastLogin:       { type: Date },
  passwordChangedAt: { type: Date }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare entered password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
