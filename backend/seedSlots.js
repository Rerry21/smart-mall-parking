const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']); // Fix for DNS error

require('dotenv').config();
const { MongoClient } = require('mongodb');

console.log("🚀 Starting seed process...");

// Create 50 parking slots organized by 3 levels
const levels = ['A', 'B', 'C'];
const slotsPerLevel = [17, 17, 16]; // 50 slots total

const slots = levels.flatMap((level, levelIndex) => {
  return Array.from({ length: slotsPerLevel[levelIndex] }, (_, i) => ({
    slotCode: `${level}${String(i + 1).padStart(2, '0')}`, // e.g., A01, A02, ...
    level,
    status: "available",
    isOccupied: false,
    occupiedBy: null,
    lastUpdated: new Date(),
    vehicleType: (i % 3 === 0) ? "car" : (i % 2 === 0) ? "bike" : "car",
  }));
});

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
