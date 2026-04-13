require('dotenv').config();
const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const hpp            = require('hpp');
const rateLimit      = require('express-rate-limit');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const http           = require('http');
const { Server }     = require('socket.io');
const multer         = require('multer');
const path           = require('path');
const fs             = require('fs');
const bcrypt         = require('bcryptjs');

const adminAuthRouter = require('./routes/adminAuth');
const authRouter      = require('./routes/auth');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      `http://${process.env.LOCAL_IP || '192.168.0.102'}:3000`,
      'https://smart-mall-parking-frontend.vercel.app',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    `http://${process.env.LOCAL_IP || '192.168.0.102'}:3000`,
    'https://smart-mall-parking-frontend.vercel.app',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10kb' }));
app.use(hpp());

// ── Custom NoSQL injection sanitizer (replaces express-mongo-sanitize) ──
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.keys(obj).forEach(key => {
        if (key.startsWith('$')) {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          sanitize(obj[key]);
        }
      });
    }
  };
  if (req.body && typeof req.body === 'object') sanitize(req.body);
  next();
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please wait 15 minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login',       authLimiter);
app.use('/api/admin-auth/login', authLimiter);

// ── Uploads ──
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
app.use('/uploads', express.static(uploadsDir));

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

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client   = new MongoClient(mongoUri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

let db;
let slotsCollection, driversCollection, bookingsCollection, finesCollection, usersCollection;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('smart_mall_parking');
    slotsCollection    = db.collection('slots');
    driversCollection  = db.collection('drivers');
    bookingsCollection = db.collection('bookings');
    finesCollection    = db.collection('fines');
    usersCollection    = db.collection('users');
    console.log('✅ Connected to MongoDB');
    app.use('/api/auth',       authRouter(db));
    app.use('/api/admin-auth', adminAuthRouter(db));
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
}

// ── Fine calculator: KSh 300/hr overstay, rounded up to nearest hour ──
function calculateFine(expiryTime, exitTime) {
  const overstayMs      = exitTime - expiryTime;
  const overstayMinutes = Math.max(0, Math.ceil(overstayMs / (1000 * 60)));
  if (overstayMinutes === 0) return { overstayMinutes: 0, totalFine: 0 };
  const overstayHours = Math.ceil(overstayMinutes / 60);
  return { overstayMinutes, totalFine: overstayHours * 300 };
}

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    status: '✅ Backend is running!',
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
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/slots/:slotCode', async (req, res) => {
  try {
    const slot = await slotsCollection.findOne({ slotCode: req.params.slotCode });
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    res.json({ success: true, data: slot });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/slots/:slotCode/toggle', async (req, res) => {
  try {
    const { slotCode } = req.params;
    const slot = await slotsCollection.findOne({ slotCode });
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    const newStatus = slot.status === 'available' ? 'occupied' : 'available';
    await slotsCollection.updateOne({ slotCode }, { $set: { status: newStatus, updatedAt: new Date() } });
    io.emit('slotStatusUpdate', { slotCode, status: newStatus });
    res.json({ success: true, slotCode, newStatus });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ============================================
// BOOKINGS
// ============================================
app.post('/api/bookings', async (req, res) => {
  try {
    const { driverPhone, slotCode, duration } = req.body;
    if (!driverPhone || !slotCode || !duration)
      return res.status(400).json({ error: 'Missing required fields: driverPhone, slotCode, duration' });

    const slot = await slotsCollection.findOne({ slotCode });
    if (!slot)                       return res.status(404).json({ error: 'Slot not found' });
    if (slot.status !== 'available') return res.status(409).json({ error: 'Slot is not available' });

    const cleanPhone = driverPhone.replace(/^\+/, '');
    const amountPaid = duration * 1;
    const now        = new Date();
    const expiryTime = new Date(now.getTime() + duration * 60 * 1000);

    const { initiateStkPush } = require('./utils/mpesa');
    let mpesaResponse;
    try {
      mpesaResponse = await initiateStkPush(cleanPhone, amountPaid, `PARK-${slotCode}`);
    } catch (mpesaErr) {
      console.error('❌ M-Pesa STK push failed:', mpesaErr.message);
      return res.status(502).json({ error: 'M-Pesa prompt could not be sent. Check your phone number and try again.' });
    }

    const newBooking = {
      driverPhone: cleanPhone, slotCode,
      entryTime: now, exitTime: null, expiryTime,
      duration, amountPaid,
      paymentStatus: 'pending',
      mpesaRefId: null,
      checkoutRequestId: mpesaResponse.CheckoutRequestID,
      overstayMinutes: 0,
      status: 'active',
      createdAt: now,
    };

    const bookingResult = await bookingsCollection.insertOne(newBooking);
    await slotsCollection.updateOne(
      { slotCode },
      { $set: { status: 'occupied', currentDriverPhone: cleanPhone, currentBookingId: bookingResult.insertedId } }
    );
    io.emit('slotStatusUpdate', { slotCode, status: 'occupied', driverPhone: cleanPhone });

    res.json({
      success: true,
      message: 'M-Pesa prompt sent — enter your PIN to confirm parking',
      booking: { bookingId: bookingResult.insertedId, driverPhone: cleanPhone, slotCode, duration, amountPaid, expiryTime, status: 'active' },
      mpesaCheckoutRequestId: mpesaResponse.CheckoutRequestID,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/payments/mpesa/callback', async (req, res) => {
  try {
    const { Body } = req.body;
    const stkCallback = Body?.stkCallback;
    if (stkCallback?.ResultCode === 0) {
      const checkoutRequestId = stkCallback.CheckoutRequestID;
      const mpesaRefId = stkCallback.CallbackMetadata?.Item?.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
      await bookingsCollection.updateOne({ checkoutRequestId }, { $set: { paymentStatus: 'paid', mpesaRefId } });
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) { res.json({ ResultCode: 1, ResultDesc: error.message }); }
});

// ── Active bookings for a specific driver ──
app.get('/api/bookings/:driverPhone', async (req, res) => {
  try {
    const bookings = await bookingsCollection.find({
      driverPhone: req.params.driverPhone, status: 'active',
    }).toArray();
    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ── ALL active bookings — used by Guard Portal for countdowns ──
app.get('/api/bookings/active/all', async (req, res) => {
  try {
    const bookings = await bookingsCollection.find(
      { status: 'active' },
      { projection: { slotCode: 1, driverPhone: 1, expiryTime: 1, entryTime: 1, duration: 1, amountPaid: 1 } }
    ).toArray();
    res.json({ success: true, data: bookings });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/bookings/:bookingId/checkout', async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!ObjectId.isValid(bookingId)) return res.status(400).json({ error: 'Invalid booking ID' });

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
        bookingId: new ObjectId(bookingId),
        driverPhone: booking.driverPhone, slotCode: booking.slotCode,
        overstayMinutes: fineData.overstayMinutes,
        totalFine: fineData.totalFine,
        fineStatus: 'unpaid', mpesaRefId: null, createdAt: now, paidAt: null,
      });
      fineId = fineResult.insertedId;
    }

    await slotsCollection.updateOne(
      { slotCode: booking.slotCode },
      { $set: { status: 'available', currentDriverPhone: null, currentBookingId: null } }
    );
    io.emit('slotStatusUpdate', { slotCode: booking.slotCode, status: 'available' });

    res.json({
      success: true, message: 'Car checked out successfully',
      checkout: { bookingId, overstayMinutes: fineData.overstayMinutes, totalFine: fineData.totalFine, fineId },
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ============================================
// FINES
// ============================================
app.get('/api/fines/:driverPhone', async (req, res) => {
  try {
    const fines = await finesCollection.find({ driverPhone: req.params.driverPhone }).toArray();
    res.json({ success: true, count: fines.length, data: fines });
  } catch (error) { res.status(500).json({ error: error.message }); }
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

    res.json({
      success: true,
      dashboard: {
        totalRevenue:   revenueData[0]?.total    || 0,
        totalFines:     totalFinesData[0]?.total || 0,
        occupiedSlots, totalSlots,
        availableSlots:  totalSlots - occupiedSlots,
        occupancyRate:   totalSlots > 0 ? `${((occupiedSlots / totalSlots) * 100).toFixed(1)}%` : '0%',
        activeBookings, unpaidFines,
      },
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ============================================
// ADMIN — DRIVERS DIRECTORY
// ============================================
app.get('/api/admin/drivers', async (req, res) => {
  try {
    const drivers = await usersCollection
      .find({ role: 'driver' }, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    const driversWithStats = await Promise.all(drivers.map(async (driver) => {
      const bookings     = await bookingsCollection.find({ driverPhone: driver.phone }).toArray();
      const totalPaid    = bookings.reduce((sum, b) => sum + (b.amountPaid || 0), 0);
      const bookingCount = bookings.length;
      const lastBooking  = [...bookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      return { ...driver, bookingCount, totalPaid, lastBookingDate: lastBooking?.createdAt || null };
    }));

    res.json({ success: true, data: driversWithStats });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
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
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/api/admin/guards', upload.single('photo'), async (req, res) => {
  try {
    const { name, phone, nationalId, assignedFloor, password } = req.body;
    if (!name || !phone || !nationalId || !password)
      return res.status(400).json({ success: false, error: 'Name, phone, national ID and password are required.' });

    const existing = await usersCollection.findOne({ $or: [{ phone }, { nationalId }] });
    if (existing)
      return res.status(409).json({ success: false, error: 'A user with this phone number or national ID already exists.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const guard = {
      name, phone, nationalId,
      assignedFloor: assignedFloor || 'Level 1',
      password: hashedPassword,
      role: 'watchman',
      photoUrl: req.file ? `/uploads/${req.file.filename}` : null,
      createdAt: new Date(),
    };
    const result = await usersCollection.insertOne(guard);
    res.status(201).json({ success: true, guardId: result.insertedId });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
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
    res.json({ success: true, message: 'Guard updated successfully.' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
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
    res.json({ success: true, message: 'Guard removed successfully.' });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

// ============================================
// SOCKET.IO
// ============================================
io.on('connection', (socket) => {
  console.log('📱 Connected:', socket.id);
  socket.on('guardToggleSlot', async ({ slotCode }) => {
    try {
      const slot = await slotsCollection.findOne({ slotCode });
      if (!slot) return;
      const newStatus = slot.status === 'available' ? 'occupied' : 'available';
      await slotsCollection.updateOne({ slotCode }, { $set: { status: newStatus, updatedAt: new Date() } });
      io.emit('slotStatusUpdate', { slotCode, status: newStatus });
    } catch (err) { console.error('Socket toggle error:', err); }
  });
  socket.on('disconnect', () => console.log('📱 Disconnected:', socket.id));
});

// ============================================
// START
// ============================================
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔒 Security: helmet + rate limiting + mongo sanitize + hpp active`);
    console.log(`📱 Mobile access: http://${process.env.LOCAL_IP || '192.168.0.102'}:${PORT}`);
  });
});
