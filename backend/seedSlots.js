// backend/seedSlots.js
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const { MongoClient } = require('mongodb');

console.log("🚀 Starting seed process...");

// 51 slots: Level A (A01-A17), Level B (B01-B17), Level C (C01-C17)
const levels = [
  { floor: 'Level A', prefix: 'A' },
  { floor: 'Level B', prefix: 'B' },
  { floor: 'Level C', prefix: 'C' },
];

const slots = [];

levels.forEach(({ floor, prefix }) => {
  for (let i = 1; i <= 17; i++) {
    const slotCode = `${prefix}${String(i).padStart(2, '0')}`;
    // Mix of types: every 5th slot is EV, every 3rd is Premium, rest Standard
    const type = (i % 5 === 0) ? 'EV' : (i % 3 === 0) ? 'Premium' : 'Standard';
    slots.push({
      slotCode,
      floor,
      section:          prefix,   // Section A, B, or C
      type,
      status:           'available',
      currentDriverPhone: null,
      currentBookingId:   null,
      lastUpdated:      new Date(),
      createdAt:        new Date(),
    });
  }
});

async function seedSlots() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB Atlas");

    const db         = client.db("smart_mall_parking");
    const collection = db.collection("slots");

    await collection.deleteMany({});
    console.log("🗑️  Cleared previous slots");

    const result = await collection.insertMany(slots);
    console.log(`🎉 SUCCESS! Seeded ${result.insertedCount} parking slots`);
    console.log(`   → Level A: A01–A17`);
    console.log(`   → Level B: B01–B17`);
    console.log(`   → Level C: C01–C17`);

  } catch (error) {
    console.error("❌ ERROR:", error.message);
  } finally {
    await client.close();
    console.log("🔚 Seeding finished. Run your backend now.");
  }
}

seedSlots();
