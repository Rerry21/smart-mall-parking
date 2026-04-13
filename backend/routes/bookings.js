// ============================================
// REPLACE backend/server.js with THIS COMPLETE VERSION
// Copy-paste EVERYTHING below into server.js
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.use(cors());
app.use(express.json());

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(mongoUri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;
let slotsCollection, driversCollection, bookingsCollection, finesCollection;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('smart_mall_parking');
    
    slotsCollection = db.collection('slots');
    driversCollection = db.collection('drivers');
    bookingsCollection = db.collection('bookings');
    finesCollection = db.collection('fines');
    
    console.log('✅ Connected to MongoDB');
    console.log('📊 Collections loaded: drivers, slots, bookings, fines');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
}

// ============================================
// UTILITY: Calculate Fine
// ============================================
function calculateFine(expiryTime, exitTime) {
  const overstayMs = exitTime - expiryTime;
  const overstayMinutes = Math.max(0, Math.ceil(overstayMs / (1000 * 60)));
  
  if (overstayMinutes === 0) {
    return { overstayMinutes: 0, totalFine: 0 };
  }
  
  const finePerMinute = 10; // KES per minute
  const totalFine = overstayMinutes * finePerMinute;
  
  return { overstayMinutes, totalFine };
}

// ============================================
// ROUTES: HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: '✅ Backend is running!',
    database: db ? '✅ MongoDB Connected' : '❌ MongoDB Not Connected',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// ROUTES: SLOTS
// ============================================

app.get('/api/slots', async (req, res) => {
  try {
    const slots = await slotsCollection.find({}).toArray();
    res.json({
      success: true,
      count: slots.length,
      data: slots
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/slots/:slotCode', async (req, res) => {
  try {
    const { slotCode } = req.params;
    const slot = await slotsCollection.findOne({ slotCode });
    
    if (!slot) {
      return res.status(404).json({ error: 'Slot not found' });
    }
    
    res.json({
      success: true,
      data: slot
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUTES: BOOKINGS (THE CORE LOGIC!)
// ============================================

// POST: Driver books a slot
app.post('/api/bookings', async (req, res) => {
  try {
    const { driverPhone, slotCode, duration } = req.body;
    
    // Validation
    if (!driverPhone || !slotCode || !duration) {
      return res.status(400).json({ 
        error: 'Missing required fields: driverPhone, slotCode, duration' 
      });
    }
    
    // Check if driver exists
    const driver = await driversCollection.findOne({ phone: driverPhone });
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }
    
    // Check if slot exists and is available
    const slot = await slotsCollection.findOne({ slotCode });
    if (!slot) {
      return res.status(404).json({ error: 'Slot not found' });
    }
    
    if (slot.status !== 'available') {
      return res.status(409).json({ error: 'Slot is not available' });
    }
    
    // Calculate amount (10 KES per minute)
    const amountPaid = duration * 10;
    
    // Create booking
    const now = new Date();
    const expiryTime = new Date(now.getTime() + duration * 60 * 1000);
    
    const newBooking = {
      driverPhone,
      slotCode,
      entryTime: now,
      exitTime: null,
      expiryTime,
      duration,
      amountPaid,
      paymentStatus: 'paid',
      mpesaRefId: `TEMP-${Date.now()}`, // Will be updated with real M-Pesa ID
      overstayMinutes: 0,
      status: 'active',
      createdAt: now
    };
    
    const bookingResult = await bookingsCollection.insertOne(newBooking);
    
    // Update slot to occupied
    await slotsCollection.updateOne(
      { slotCode },
      {
        $set: {
          status: 'occupied',
          currentDriverPhone: driverPhone,
          currentBookingId: bookingResult.insertedId
        }
      }
    );
    
    // Emit Socket.io event to update all clients
    io.emit('slotStatusUpdate', {
      slotCode,
      status: 'occupied',
      driverPhone
    });
    
    res.json({
      success: true,
      message: 'Booking created successfully',
      booking: {
        bookingId: bookingResult.insertedId,
        driverPhone,
        slotCode,
        duration,
        amountPaid,
        expiryTime,
        status: 'active'
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Driver's active bookings
app.get('/api/bookings/:driverPhone', async (req, res) => {
  try {
    const { driverPhone } = req.params;
    
    const bookings = await bookingsCollection.find({
      driverPhone,
      status: 'active'
    }).toArray();
    
    res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Watchman checks car IN
app.post('/api/bookings/:bookingId/checkin', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    if (!ObjectId.isValid(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }
    
    const booking = await bookingsCollection.findOne({
      _id: new ObjectId(bookingId)
    });
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Update booking with check-in time
    await bookingsCollection.updateOne(
      { _id: new ObjectId(bookingId) },
      { $set: { entryTime: new Date() } }
    );
    
    // Emit event
    io.emit('carCheckedIn', {
      bookingId,
      slotCode: booking.slotCode,
      driverPhone: booking.driverPhone
    });
    
    res.json({
      success: true,
      message: 'Car checked in successfully'
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Watchman checks car OUT (THE MAGIC HAPPENS HERE!)
app.post('/api/bookings/:bookingId/checkout', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    if (!ObjectId.isValid(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }
    
    const booking = await bookingsCollection.findOne({
      _id: new ObjectId(bookingId)
    });
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Calculate fine
    const now = new Date();
    const fineData = calculateFine(booking.expiryTime, now);
    
    // Update booking
    await bookingsCollection.updateOne(
      { _id: new ObjectId(bookingId) },
      {
        $set: {
          exitTime: now,
          overstayMinutes: fineData.overstayMinutes,
          status: 'completed'
        }
      }
    );
    
    // If overstay, create fine document
    let fineId = null;
    if (fineData.overstayMinutes > 0) {
      const newFine = {
        bookingId: new ObjectId(bookingId),
        driverPhone: booking.driverPhone,
        slotCode: booking.slotCode,
        overstayMinutes: fineData.overstayMinutes,
        finePerMinute: 10,
        totalFine: fineData.totalFine,
        fineStatus: 'unpaid',
        mpesaRefId: null,
        createdAt: now,
        paidAt: null
      };
      
      const fineResult = await finesCollection.insertOne(newFine);
      fineId = fineResult.insertedId;
    }
    
    // Update slot to available
    await slotsCollection.updateOne(
      { slotCode: booking.slotCode },
      {
        $set: {
          status: 'available',
          currentDriverPhone: null,
          currentBookingId: null
        }
      }
    );
    
    // Emit event
    io.emit('slotStatusUpdate', {
      slotCode: booking.slotCode,
      status: 'available'
    });
    
    res.json({
      success: true,
      message: 'Car checked out successfully',
      checkout: {
        bookingId,
        overstayMinutes: fineData.overstayMinutes,
        totalFine: fineData.totalFine,
        fineId: fineId || null,
        durationParked: booking.duration,
        status: 'completed'
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Extend booking
app.post('/api/bookings/:bookingId/extend', async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { additionalMinutes } = req.body;
    
    if (!additionalMinutes || additionalMinutes <= 0) {
      return res.status(400).json({ error: 'Invalid additional minutes' });
    }
    
    const booking = await bookingsCollection.findOne({
      _id: new ObjectId(bookingId)
    });
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    // Extend expiry time
    const newExpiryTime = new Date(booking.expiryTime.getTime() + additionalMinutes * 60 * 1000);
    const additionalCost = additionalMinutes * 10;
    
    await bookingsCollection.updateOne(
      { _id: new ObjectId(bookingId) },
      {
        $set: {
          expiryTime: newExpiryTime,
          duration: booking.duration + additionalMinutes,
          amountPaid: booking.amountPaid + additionalCost
        }
      }
    );
    
    res.json({
      success: true,
      message: 'Booking extended successfully',
      extension: {
        bookingId,
        newExpiryTime,
        additionalMinutes,
        additionalCost,
        totalAmountPaid: booking.amountPaid + additionalCost
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUTES: FINES
// ============================================

app.get('/api/fines/:driverPhone', async (req, res) => {
  try {
    const { driverPhone } = req.params;
    
    const fines = await finesCollection.find({
      driverPhone
    }).toArray();
    
    res.json({
      success: true,
      count: fines.length,
      data: fines
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fines/:fineId/pay', async (req, res) => {
  try {
    const { fineId } = req.params;
    const { mpesaRefId } = req.body;
    
    if (!mpesaRefId) {
      return res.status(400).json({ error: 'M-Pesa reference ID required' });
    }
    
    const fine = await finesCollection.findOne({
      _id: new ObjectId(fineId)
    });
    
    if (!fine) {
      return res.status(404).json({ error: 'Fine not found' });
    }
    
    // Update fine as paid
    await finesCollection.updateOne(
      { _id: new ObjectId(fineId) },
      {
        $set: {
          fineStatus: 'paid',
          mpesaRefId,
          paidAt: new Date()
        }
      }
    );
    
    res.json({
      success: true,
      message: 'Fine paid successfully',
      fine: {
        fineId,
        totalFine: fine.totalFine,
        status: 'paid',
        mpesaRefId
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ROUTES: ADMIN DASHBOARD
// ============================================

app.get('/api/admin/dashboard', async (req, res) => {
  try {
    // Total revenue
    const revenueData = await bookingsCollection.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } }
    ]).toArray();
    
    // Total fines
    const finesData = await finesCollection.aggregate([
      { $group: { _id: null, total: { $sum: '$totalFine' } } }
    ]).toArray();
    
    // Occupancy
    const occupiedSlots = await slotsCollection.countDocuments({ status: 'occupied' });
    const totalSlots = await slotsCollection.countDocuments({});
    const occupancyRate = ((occupiedSlots / totalSlots) * 100).toFixed(2);
    
    // Active bookings
    const activeBookings = await bookingsCollection.countDocuments({ status: 'active' });
    
    // Unpaid fines
    const unpaidFines = await finesCollection.countDocuments({ fineStatus: 'unpaid' });
    
    res.json({
      success: true,
      dashboard: {
        totalRevenue: revenueData[0]?.total || 0,
        totalFines: finesData[0]?.total || 0,
        occupiedSlots,
        totalSlots,
        occupancyRate: `${occupancyRate}%`,
        activeBookings,
        unpaidFines,
        availableSlots: totalSlots - occupiedSlots
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/fines', async (req, res) => {
  try {
    const fines = await finesCollection.find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json({
      success: true,
      count: fines.length,
      data: fines
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/revenue', async (req, res) => {
  try {
    const revenue = await bookingsCollection.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$amountPaid' },
          count: { $sum: 1 },
          avgPerBooking: { $avg: '$amountPaid' }
        }
      }
    ]).toArray();
    
    res.json({
      success: true,
      data: revenue[0] || { total: 0, count: 0, avgPerBooking: 0 }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SOCKET.IO
// ============================================

io.on('connection', (socket) => {
  console.log('📱 User connected:', socket.id);
  
  socket.on('slotUpdated', (slotData) => {
    console.log('🔄 Slot Update:', slotData);
    io.emit('slotChanged', slotData);
  });
  
  socket.on('disconnect', () => {
    console.log('📱 User disconnected:', socket.id);
  });
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({ error: err.message });
});

// ============================================
// START
// ============================================

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔗 Frontend connected to: http://localhost:3000`);
  });
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});