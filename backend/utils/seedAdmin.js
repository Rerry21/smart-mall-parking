
require('dotenv').config({ path: '../.env' });
const { MongoClient, ServerApiVersion } = require('mongodb');
const bcrypt = require('bcrypt');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';

async function seedAdmin() {
  const client = new MongoClient(mongoUri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
  });

  try {
    await client.connect();
    const db      = client.db('smart_mall_parking');
    const admins  = db.collection('admins');

    // Check if Rerry already exists so we don't duplicate
    const existing = await admins.findOne({ username: 'Rerry' });
    if (existing) {
      console.log('⚠️  Admin "Rerry" already exists — skipping seed.');
      return;
    }

  
    const hashedPassword = await bcrypt.hash('Password123', 12);

    await admins.insertOne({
      username:  'Rerry',
      password:  hashedPassword, 
      role:      'admin',
      createdAt: new Date(),
    });

    console.log('✅ Admin "Rerry" created successfully with hashed password.');
    console.log('   Username: Rerry');
    console.log('   Password: Password123  (stored as bcrypt hash)');

  } catch (err) {
    console.error('❌ Seed error:', err);
  } finally {
    await client.close();
  }
}

seedAdmin();