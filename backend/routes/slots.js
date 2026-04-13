const express = require('express');
const router = express.Router();

/**
 * @param {Collection} slotsCollection - Passed from server.js
 */
module.exports = (slotsCollection) => {

    // 1. GET ALL SLOTS
    // This is what the Driver Portal calls to show the map
    router.get('/', async (req, res) => {
        try {
            // Fetches every document in the 'slots' collection
            const slots = await slotsCollection.find({}).toArray();
            
            // Sends the array of slots to the frontend
            res.json(slots);
        } catch (error) {
            console.error("❌ Error fetching all slots:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    // 2. GET SINGLE SLOT DETAILS
    // Useful if you want to show specific info for one slot (e.g., A1)
    router.get('/:slotCode', async (req, res) => {
        try {
            const { slotCode } = req.params;
            const slot = await slotsCollection.findOne({ slotCode: slotCode });

            if (!slot) {
                return res.status(404).json({ error: 'Parking slot not found' });
            }

            res.json(slot);
        } catch (error) {
            console.error(`❌ Error fetching slot ${req.params.slotCode}:`, error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    });

    // 3. GET AVAILABLE SLOTS ONLY
    // Optional: useful for a "Quick Book" feature
    router.get('/status/available', async (req, res) => {
        try {
            const availableSlots = await slotsCollection.find({ status: 'available' }).toArray();
            res.json(availableSlots);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};