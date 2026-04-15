// ── Force Google DNS before anything else ──
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const http       = require('http');
const { Server } = require('socket.io');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const bcrypt     = require('bcryptjs');

// Routes
const adminAuthRouter = require('./routes/adminAuth');
const authRouter      = require('./routes/auth');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] },
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Photo uploads folder ──
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

// ── Multer config ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename:    (req, file, cb) => cb(null, `guard-${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Only image files are allowed'));
  },
});

// ── MongoDB ──
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const client   = new MongoClient(mongoUri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 10000,
});

let db;
let slotsCollection, bookingsCollection, finesCollection, usersCollection, messagesCollection;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('smart_mall_parking');

    slotsCollection    = db.collection('slots');
    bookingsCollection = db.collection('bookings');
    finesCollection    = db.collection('fines');
    usersCollection    = db.collection('users');
    messagesCollection = db.collection('messages');

    console.log('✅ Connected to MongoDB');
    console.log('📦 Database: smart_mall_parking');

    app.use('/api/auth',       authRouter(db));
    app.use('/api/admin-auth', adminAuthRouter(db));

  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
}

// ── Fine calculator ──
function calculateFine(expiryTime, exitTime) {
  const overstayMs      = exitTime - expiryTime;
  const overstayMinutes = Math.max(0, Math.ceil(overstayMs / (1000 * 60)));
  if (overstayMinutes === 0) return { overstayMinutes: 0, totalFine: 0 };
  return { overstayMinutes, totalFine: 300 }; // KSh 300 flat fine
}

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    status:    '✅ Backend is running!',
    database:  db ? '✅ MongoDB Connected' : '❌ Not Connected',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// SLOTS
// ============================================
app.get('/api/slots', async (req, res) => {
  try {
    const slots = await slotsCollection.find({}).toArray();
    res.json({ success: true, count: slots.length, data: slots });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/slots/:slotCode', async (req, res) => {
  try {
    const slot = await slotsCollection.findOne({ slotCode: req.params.slotCode });
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    res.json({ success: true, data: slot });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/slots/:slotCode/toggle', async (req, res) => {
  try {
    const { slotCode } = req.params;
    const slot = await slotsCollection.findOne({ slotCode });
    if (!slot) return res.status(404).json({ error: `Slot not found: ${slotCode}` });

    const newStatus = slot.status === 'available' ? 'occupied' : 'available';
    await slotsCollection.updateOne(
      { slotCode },
      { $set: { status: newStatus, updatedAt: new Date() } }
    );
    io.emit('slotStatusUpdate', { slotCode, status: newStatus });
    res.json({ success: true, slotCode, newStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// BOOKINGS — DEMO (no real M-Pesa)
// ============================================
app.post('/api/bookings/demo', async (req, res) => {
  try {
    const { driverPhone, slotCode, duration, driverName, plateNumber } = req.body;

    const slot = await slotsCollection.findOne({ slotCode });
    if (!slot)                       return res.status(404).json({ error: 'Slot not found' });
    if (slot.status !== 'available') return res.status(409).json({ error: 'Slot is already occupied' });

    const cleanPhone  = driverPhone.replace(/^\+/, '');
    const amountPaid  = Math.round(duration * 1);  // KSh 1/min → KSh 60/hr
    const now         = new Date();
    const expiryTime  = new Date(now.getTime() + duration * 60 * 1000);

    const newBooking = {
      driverPhone:       cleanPhone,
      driverName:        driverName  || '',
      plateNumber:       plateNumber || '',
      slotCode,
      entryTime:         now,
      exitTime:          null,
      expiryTime,
      duration,
      amountPaid,
      paymentStatus:     'paid',   // demo — treat as instantly paid
      mpesaRefId:        `DEMO-${Date.now()}`,
      checkoutRequestId: null,
      overstayMinutes:   0,
      fineAmount:        0,
      fineStatus:        'none',
      status:            'active',
      createdAt:         now,
    };

    const bookingResult = await bookingsCollection.insertOne(newBooking);

    await slotsCollection.updateOne(
      { slotCode },
      {
        $set: {
          status:             'occupied',
          currentDriverPhone: cleanPhone,
          currentDriverName:  driverName  || '',
          currentPlateNumber: plateNumber || '',
          currentBookingId:   bookingResult.insertedId,
          currentExpiryTime:  expiryTime,
        },
      }
    );

    io.emit('slotStatusUpdate', {
      slotCode,
      status:      'occupied',
      driverPhone: cleanPhone,
      driverName:  driverName  || '',
      plateNumber: plateNumber || '',
      expiryTime,
      bookingId:   bookingResult.insertedId,
    });

    res.json({
      success:   true,
      message:   'Booking confirmed!',
      booking: {
        bookingId:   bookingResult.insertedId,
        driverPhone: cleanPhone,
        slotCode,
        duration,
        amountPaid,
        expiryTime,
        status:      'active',
      },
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET active bookings for a specific driver
app.get('/api/bookings/:driverPhone', async (req, res) => {
  try {
    const bookings = await bookingsCollection
      .find({ driverPhone: req.params.driverPhone, status: 'active' })
      .toArray();
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET all active bookings (for guard portal)
app.get('/api/bookings/active/all', async (req, res) => {
  try {
    const bookings = await bookingsCollection
      .find({ status: 'active' })
      .toArray();
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CHECKOUT
app.post('/api/bookings/:bookingId/checkout', async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!ObjectId.isValid(bookingId))
      return res.status(400).json({ error: 'Invalid booking ID' });

    const booking = await bookingsCollection.findOne({ _id: new ObjectId(bookingId) });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const now      = new Date();
    const fineData = calculateFine(booking.expiryTime, now);

    await bookingsCollection.updateOne(
      { _id: new ObjectId(bookingId) },
      { $set: { exitTime: now, overstayMinutes: fineData.overstayMinutes, status: 'completed' } }
    );

    let fineId = null;
    if (fineData.overstayMinutes > 0) {
      const fineResult = await finesCollection.insertOne({
        bookingId:       new ObjectId(bookingId),
        driverPhone:     booking.driverPhone,
        driverName:      booking.driverName  || '',
        plateNumber:     booking.plateNumber || '',
        slotCode:        booking.slotCode,
        overstayMinutes: fineData.overstayMinutes,
        totalFine:       300,
        fineStatus:      'unpaid',
        mpesaRefId:      null,
        createdAt:       now,
        paidAt:          null,
      });
      fineId = fineResult.insertedId;

      // Emit alert for admin
      io.emit('newFineAlert', {
        driverPhone:     booking.driverPhone,
        driverName:      booking.driverName || '',
        slotCode:        booking.slotCode,
        overstayMinutes: fineData.overstayMinutes,
        totalFine:       300,
        createdAt:       now,
      });
    }

    await slotsCollection.updateOne(
      { slotCode: booking.slotCode },
      { $set: { status: 'available', currentDriverPhone: null, currentBookingId: null, currentExpiryTime: null, currentDriverName: null, currentPlateNumber: null } }
    );

    io.emit('slotStatusUpdate', { slotCode: booking.slotCode, status: 'available' });

    res.json({
      success: true,
      message: 'Checked out successfully',
      checkout: { bookingId, overstayMinutes: fineData.overstayMinutes, totalFine: fineData.totalFine, fineId },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Record a fine when a driver overstays (called by frontend timer)
app.post('/api/fines/record', async (req, res) => {
  try {
    const { bookingId, driverPhone, driverName, plateNumber, slotCode, overstayMinutes } = req.body;

    // Check if fine already recorded for this booking
    const existing = await finesCollection.findOne({ bookingId: bookingId });
    if (existing) return res.json({ success: true, message: 'Fine already recorded', fineId: existing._id });

    const now = new Date();
    const fineResult = await finesCollection.insertOne({
      bookingId,
      driverPhone,
      driverName:      driverName  || '',
      plateNumber:     plateNumber || '',
      slotCode,
      overstayMinutes: overstayMinutes || 0,
      totalFine:       300,
      fineStatus:      'unpaid',
      mpesaRefId:      null,
      createdAt:       now,
      paidAt:          null,
    });

    // Update booking with fine info
    if (ObjectId.isValid(bookingId)) {
      await bookingsCollection.updateOne(
        { _id: new ObjectId(bookingId) },
        { $set: { fineAmount: 300, fineStatus: 'unpaid' } }
      );
    }

    io.emit('newFineAlert', { driverPhone, driverName, slotCode, totalFine: 300, createdAt: now });

    res.json({ success: true, fineId: fineResult.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// FINES
// ============================================
app.get('/api/fines/:driverPhone', async (req, res) => {
  try {
    const fines = await finesCollection
      .find({ driverPhone: req.params.driverPhone })
      .toArray();
    res.json({ success: true, count: fines.length, data: fines });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fines', async (req, res) => {
  try {
    const fines = await finesCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ success: true, count: fines.length, data: fines });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN DASHBOARD STATS
// ============================================
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    const revenueData = await bookingsCollection.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } },
    ]).toArray();

    const occupiedSlots  = await slotsCollection.countDocuments({ status: 'occupied' });
    const totalSlots     = await slotsCollection.countDocuments({});
    const activeBookings = await bookingsCollection.countDocuments({ status: 'active' });
    const unpaidFines    = await finesCollection.countDocuments({ fineStatus: 'unpaid' });
    const totalFinesData = await finesCollection.aggregate([
      { $group: { _id: null, total: { $sum: '$totalFine' } } },
    ]).toArray();
    const totalDrivers   = await usersCollection.countDocuments({ role: 'driver' });

    res.json({
      success: true,
      dashboard: {
        totalRevenue:    revenueData[0]?.total    || 0,
        totalFines:      totalFinesData[0]?.total || 0,
        occupiedSlots,
        totalSlots,
        availableSlots:  totalSlots - occupiedSlots,
        occupancyRate:   totalSlots > 0
          ? `${((occupiedSlots / totalSlots) * 100).toFixed(1)}%`
          : '0%',
        activeBookings,
        unpaidFines,
        totalDrivers,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN — DRIVERS
// ============================================
app.get('/api/admin/drivers', async (req, res) => {
  try {
    const drivers = await usersCollection
      .find({ role: 'driver' }, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    // Attach booking stats for each driver
    const driversWithStats = await Promise.all(drivers.map(async (d) => {
      const phone = d.phone?.replace(/^\+/, '') || '';
      const bookings = await bookingsCollection
        .find({ driverPhone: phone })
        .toArray();
      const totalPaid = bookings.reduce((sum, b) => sum + (b.amountPaid || 0), 0);
      const lastBooking = bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      return {
        ...d,
        bookingCount:    bookings.length,
        totalPaid,
        lastBookingDate: lastBooking?.createdAt || null,
      };
    }));

    res.json({ success: true, data: driversWithStats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ADMIN — GUARD MANAGEMENT
// ============================================
app.get('/api/admin/guards', async (req, res) => {
  try {
    const guards = await usersCollection
      .find({ role: 'watchman' }, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ success: true, data: guards });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/admin/guards', upload.single('photo'), async (req, res) => {
  try {
    const { name, phone, nationalId, assignedFloor, password } = req.body;

    if (!name || !phone || !nationalId || !password)
      return res.status(400).json({ success: false, error: 'Name, phone, national ID and password are required.' });

    const existing = await usersCollection.findOne({ $or: [{ phone }, { nationalId }] });
    if (existing)
      return res.status(409).json({ success: false, error: 'A user with this phone or national ID already exists.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const guard = {
      name, phone, nationalId,
      assignedFloor: assignedFloor || 'Level A',
      password:      hashedPassword,
      role:          'watchman',
      photoUrl:      req.file ? `/uploads/${req.file.filename}` : null,
      createdAt:     new Date(),
    };

    const result = await usersCollection.insertOne(guard);
    res.status(201).json({ success: true, guardId: result.insertedId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/admin/guards/:id', upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id))
      return res.status(400).json({ success: false, error: 'Invalid guard ID.' });

    const guard = await usersCollection.findOne({ _id: new ObjectId(id), role: 'watchman' });
    if (!guard)
      return res.status(404).json({ success: false, error: 'Guard not found.' });

    const { name, phone, nationalId, assignedFloor, password } = req.body;

    if (phone || nationalId) {
      const orConditions = [];
      if (phone)      orConditions.push({ phone });
      if (nationalId) orConditions.push({ nationalId });
      const duplicate = await usersCollection.findOne({ _id: { $ne: new ObjectId(id) }, $or: orConditions });
      if (duplicate)
        return res.status(409).json({ success: false, error: 'Another user already has this phone or national ID.' });
    }

    const updates = {};
    if (name)          updates.name          = name;
    if (phone)         updates.phone         = phone;
    if (nationalId)    updates.nationalId    = nationalId;
    if (assignedFloor) updates.assignedFloor = assignedFloor;
    if (password)      updates.password      = await bcrypt.hash(password, 10);
    if (req.file) {
      if (guard.photoUrl) {
        const oldPath = path.join(__dirname, guard.photoUrl);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updates.photoUrl = `/uploads/${req.file.filename}`;
    }

    await usersCollection.updateOne({ _id: new ObjectId(id) }, { $set: updates });
    res.json({ success: true, message: 'Guard updated.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/admin/guards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id))
      return res.status(400).json({ success: false, error: 'Invalid guard ID.' });

    const guard = await usersCollection.findOne({ _id: new ObjectId(id), role: 'watchman' });
    if (!guard)
      return res.status(404).json({ success: false, error: 'Guard not found.' });

    if (guard.photoUrl) {
      const photoPath = path.join(__dirname, guard.photoUrl);
      if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
    }

    await usersCollection.deleteOne({ _id: new ObjectId(id) });
    res.json({ success: true, message: 'Guard removed.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MESSAGES (Ask a Question)
// ============================================
app.post('/api/messages', async (req, res) => {
  try {
    const { senderName, senderPhone, senderRole, message } = req.body;

    if (!message || !senderPhone)
      return res.status(400).json({ success: false, error: 'Message and phone are required.' });

    const newMessage = {
      senderName:  senderName  || 'Unknown',
      senderPhone: senderPhone || '',
      senderRole:  senderRole  || 'driver',
      message,
      read:        false,
      createdAt:   new Date(),
    };

    const result = await messagesCollection.insertOne(newMessage);

    // Notify admin in real-time
    io.emit('newMessage', newMessage);

    res.status(201).json({ success: true, messageId: result.insertedId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const messages = await messagesCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ success: true, count: messages.length, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/messages/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ success: false });
    await messagesCollection.updateOne({ _id: new ObjectId(id) }, { $set: { read: true } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SOCKET.IO
// ============================================
io.on('connection', (socket) => {
  console.log('📱 Client connected:', socket.id);

  socket.on('guardToggleSlot', async ({ slotCode }) => {
    try {
      const slot = await slotsCollection.findOne({ slotCode });
      if (!slot) return;
      const newStatus = slot.status === 'available' ? 'occupied' : 'available';
      await slotsCollection.updateOne(
        { slotCode },
        { $set: { status: newStatus, updatedAt: new Date() } }
      );
      io.emit('slotStatusUpdate', { slotCode, status: newStatus });
    } catch (err) {
      console.error('Socket toggle error:', err);
    }
  });

  socket.on('disconnect', () => console.log('📱 Client disconnected:', socket.id));
});

// ============================================
// START
// ============================================
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
  });
});
