const express = require('express');
const router = express.Router();

// GET: All fines for a driver
router.get('/driver/:driverPhone', async (req, res) => {
  try {
    const { driverPhone } = req.params;
    
    // Query: db.fines.find({ 
    //   driverPhone: "+254712345678",
    //   fineStatus: "unpaid"
    // })
    
    res.json({ message: "GET /api/fines/driver/:driverPhone - TO BE IMPLEMENTED" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Driver pays a fine via M-Pesa
router.post('/:fineId/pay', async (req, res) => {
  try {
    const { fineId } = req.params;
    const { mpesaRefId } = req.body;
    
    // 1. Find fine
    // 2. Verify M-Pesa payment
    // 3. Update fine: fineStatus = "paid"
    // 4. Update fine: paidAt = now
    
    res.json({ message: "POST /api/fines/:fineId/pay - TO BE IMPLEMENTED" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;