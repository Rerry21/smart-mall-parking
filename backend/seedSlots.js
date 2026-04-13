// backend/seedSlots.js
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);   // ← Fix for DNS error

require('dotenv').config();
const { MongoClient } = require('mongodb');

console.log("🚀 Starting seed process...");

const slots = Array.from({ length: 51 }, (_, i) => ({
  slotNumber: `A${String(i + 1).padStart(2, '0')}`,
  status: "available",
  vehicleType: (i % 3 === 0) ? "car" : (i % 5 === 0) ? "bike" : "car",
  isOccupied: false,
  occupiedBy: null,
  lastUpdated: new Date()
}));

async function seedSlots() {
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB Atlas");

    const db = client.db("smart_mall_parking");
    const collection = db.collection("slots");

    await collection.deleteMany({});
    console.log("🗑️ Cleared previous slots");

    const result = await collection.insertMany(slots);
    console.log(`🎉 SUCCESS! Seeded ${result.insertedCount} parking slots`);

  } catch (error) {
    console.error("❌ ERROR:", error.message);
  } finally {
    await client.close();
    console.log("🔚 Seeding finished.");
  }
}

seedSlots();