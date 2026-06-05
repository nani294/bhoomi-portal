const mongoose = require('mongoose');

const ownershipHistorySchema = new mongoose.Schema({
  ownerName: { type: String, required: true },
  ownerAadhaar: String,
  ownerContact: String,
  fromDate: { type: Date, required: true },
  toDate: { type: Date },
  transferType: { type: String, enum: ['purchase', 'inheritance', 'gift', 'court_order', 'government_allotment', 'auction'], default: 'purchase' },
  registrationNumber: String,
  remarks: String
});

const boundarySchema = new mongoose.Schema({
  north: String, south: String, east: String, west: String
});

const gisDataSchema = new mongoose.Schema({
  latitude: Number, 
  longitude: Number,
  area: Number, 
  perimeter: Number,
  geometry: {
    type: { type: String, enum: ['Point', 'Polygon'], default: 'Point' },
    coordinates: mongoose.Schema.Types.Mixed // [lng, lat] for Point, [[ [lng, lat], ... ]] for Polygon
  }
});

const encumbranceSchema = new mongoose.Schema({
  type: { type: String, enum: ['mortgage', 'lien', 'court_stay', 'government_acquisition', 'none'], default: 'none' },
  details: String, fromDate: Date, toDate: Date,
  isActive: { type: Boolean, default: false }
});

const landRecordSchema = new mongoose.Schema({
  surveyNumber: { type: String, required: true, uppercase: true },
  subDivision: String,
  registrationId: { type: String },
  pattaNumber: String,
  currentOwner: {
    name: { type: String, required: true },
    aadhaarNumber: String,
    contact: String,
    email: String,
    address: String
  },
  district: { type: String, required: true },
  mandal: { type: String, required: true },
  village: { type: String, required: true },
  pincode: String,
  taluk: String,
  landType: { type: String, enum: ['agricultural', 'residential', 'commercial', 'industrial', 'government', 'forest', 'water_body'], required: true },
  landUse: String,
  extent: {
    value: { type: Number, required: true },
    unit: { type: String, enum: ['acres', 'sq_yards', 'sq_meters', 'guntas', 'cents'], default: 'acres' }
  },
  marketValue: Number,
  guidanceValue: Number,
  status: {
    type: String,
    enum: ['active', 'disputed', 'encumbered', 'under_mutation', 'government_acquired', 'court_stay'],
    default: 'active'
  },
  verificationStatus: {
    type: String,
    enum: ['verified', 'pending', 'under_review', 'rejected'],
    default: 'pending'
  },
  boundaries: boundarySchema,
  gisData: gisDataSchema,
  encumbrance: encumbranceSchema,
  ownershipHistory: [ownershipHistorySchema],
  documents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
  registrationDate: Date,
  lastMutationDate: Date,
  lastVerifiedDate: Date,
  lastVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isFlagged: { type: Boolean, default: false },
  flagReason: String,
  remarks: String
}, { timestamps: true });

// Auto-generate registrationId
landRecordSchema.pre('save', async function(next) {
  if (!this.registrationId) {
    const year = new Date().getFullYear();
    const count = await mongoose.model('LandRecord').countDocuments();
    this.registrationId = `REG-${year}-${String(count + 1001).padStart(5, '0')}`;
  }
  next();
});

// Single index definitions only here — no duplicates
landRecordSchema.index({ surveyNumber: 1 }, { unique: true });
landRecordSchema.index({ registrationId: 1 }, { unique: true, sparse: true });
landRecordSchema.index({ 'currentOwner.name': 'text' });
landRecordSchema.index({ district: 1, mandal: 1 });
landRecordSchema.index({ verificationStatus: 1 });

module.exports = mongoose.model('LandRecord', landRecordSchema);
