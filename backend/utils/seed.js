require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in .env. Please set your MongoDB Atlas connection string.');
  process.exit(1);
}
const MONGODB_URI = process.env.MONGODB_URI;

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Drop all collections to start fresh
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      await db.collection(col.name).drop().catch(() => {});
    }
    console.log('✅ Database cleared — ready for use');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  BhoomiSeva database is ready!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('  To create your Admin account, run:');
    console.log('');
    console.log('  node utils/createAdmin.js');
    console.log('');
    console.log('  Then login and add officers from User Management.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();
