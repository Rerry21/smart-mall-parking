const express = require('express');
const router = express.Router();

// GET: Dashboard stats
// Returns: { totalRevenue, totalFines, occupancyRate, activeBookings }
router.get('/dashboard', async (req, res) => {
  try {
    // 1. Total revenue = sum of all bookings.amountPaid
    // 2. Total fines = sum of all fines.totalFine
    // 3. Occupancy rate = (occupied slots / 50) * 100
    // 4. Active bookings = count of bookings with status "active"
    
    res.json({ message: "GET /api/admin/dashboard - TO BE IMPLEMENTED" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: All fines (unpaid/paid)
router.get('/fines', async (req, res) => {
  try {
    // Query: db.fines.find({})
    // Sort by createdAt desc
    
    res.json({ message: "GET /api/admin/fines - TO BE IMPLEMENTED" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;