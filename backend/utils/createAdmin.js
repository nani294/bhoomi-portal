require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../models/User');

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env. Please set your MongoDB Atlas connection string.');
  process.exit(1);
}
const MONGODB_URI = process.env.MONGODB_URI;

// Simple prompt helper
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise(resolve => rl.question(question, resolve));

async function createAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('\n✅ Connected to MongoDB');

    // Check if admin already exists
    const existing = await User.findOne({ role: 'admin' });
    if (existing) {
      console.log('\n⚠️  An admin account already exists:');
      console.log('   Name  :', existing.fullName);
      console.log('   Email :', existing.email);
      console.log('\n   Login at http://localhost:3000 using that email.\n');
      rl.close();
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Create Admin Account for BhoomiSeva Portal');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const fullName    = await ask('  Enter Full Name       : ');
    const email       = await ask('  Enter Email Address   : ');
    const phone       = await ask('  Enter Phone Number    : ');
    const password    = await ask('  Enter Password        : ');
    const district    = await ask('  Enter District        : ');
    const designation = await ask('  Enter Designation     : ');
    const employeeId  = await ask('  Enter Employee ID     : ');

    rl.close();

    // Validate
    if (!fullName || !email || !phone || !password) {
      console.log('\n❌ Full name, email, phone and password are all required.\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    if (!email.includes('@')) {
      console.log('\n❌ Please enter a valid email address.\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    if (password.length < 8) {
      console.log('\n❌ Password must be at least 8 characters.\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    if (phone.length !== 10) {
      console.log('\n❌ Phone number must be exactly 10 digits.\n');
      await mongoose.disconnect();
      process.exit(1);
    }

    // Create admin
    const admin = await User.create({
      fullName:     fullName.trim(),
      email:        email.trim().toLowerCase(),
      password:     password,
      phone:        phone.trim(),
      role:         'admin',
      district:     district.trim() || undefined,
      designation:  designation.trim() || undefined,
      employeeId:   employeeId.trim() || undefined,
      isActive:     true,
      isEmailVerified: true
    });

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ✅ Admin Account Created Successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Name       :', admin.fullName);
    console.log('  Email      :', admin.email);
    console.log('  Role       :', admin.role);
    console.log('  District   :', admin.district || '—');
    console.log('  Employee ID:', admin.employeeId || '—');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('  Next Steps:');
    console.log('  1. Start the server   : npm run dev');
    console.log('  2. Open browser       : http://localhost:3000');
    console.log('  3. Click Admin tab    : login with your email');
    console.log('  4. Go to User Mgmt    : add officers and staff');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    rl.close();
    if (err.code === 11000) {
      console.error('\n❌ That email is already registered. Use a different email.\n');
    } else {
      console.error('\n❌ Failed:', err.message, '\n');
    }
    await mongoose.disconnect();
    process.exit(1);
  }
}

createAdmin();
