const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { timingSafeEqual } = require('crypto');
const db = require('./config/db');
const { getInitialBookingStatus, getReviewBookingStatus } = require('./bookingLogic');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '.env.admin') });

const app = express();
app.use(cors());
app.use(express.json());

const uploadDirectory = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

const pendingRegistrations = new Map();

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'development-secret');
    if (req.user.role === 'admin' || !req.user.userId) {
      return res.status(403).json({ error: 'Customer account access required' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
};

const authenticateAdmin = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Admin authentication required' });

  try {
    const claims = jwt.verify(token, process.env.JWT_SECRET || 'development-secret');
    if (claims.role !== 'admin') return res.status(403).json({ error: 'Administrator access required' });
    req.admin = claims;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired admin session' });
  }
};

const constantTimeEqual = (provided, expected) => {
  const providedBuffer = Buffer.from(String(provided || ''));
  const expectedBuffer = Buffer.from(String(expected || ''));
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
};

app.post('/api/admin/login', (req, res) => {
  const configuredUsername = process.env.ADMIN_USERNAME;
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredUsername || !configuredPassword) {
    return res.status(503).json({ error: 'Admin login is not configured on the server' });
  }

  if (!constantTimeEqual(req.body.username, configuredUsername) || !constantTimeEqual(req.body.password, configuredPassword)) {
    return res.status(401).json({ error: 'Invalid admin username or password' });
  }

  const token = jwt.sign({ role: 'admin', username: configuredUsername }, process.env.JWT_SECRET || 'development-secret', { expiresIn: '8h' });
  res.json({ token, admin: { username: configuredUsername } });
});

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT u.id, u.name, u.email, u.phone, u.aadhaar_id, u.created_at,
              COALESCE(lv.verification_status, 'not_submitted') AS license_status,
              COUNT(b.id) AS booking_count, MAX(b.start_date) AS latest_booking_date
       FROM users u
       LEFT JOIN license_verifications lv ON lv.user_id = u.id
       LEFT JOIN bookings b ON b.user_id = u.id
       GROUP BY u.id, u.name, u.email, u.phone, u.aadhaar_id, u.created_at, lv.verification_status
       ORDER BY u.created_at DESC`
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users/:userId', authenticateAdmin, async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, name, email, phone, aadhaar_id, created_at FROM users WHERE id = ? LIMIT 1',
      [req.params.userId]
    );
    if (!users[0]) return res.status(404).json({ error: 'User not found' });

    const [bookings] = await db.query(
      `SELECT b.id, b.start_date, b.end_date, b.pickup_time, b.checkout_time,
              b.total_amount, b.status, b.deployment_status, v.brand, v.model,
              pl.name AS pickup_location_name, pl.address AS pickup_location_address,
              pl.city AS pickup_location_city
       FROM bookings b
       JOIN vehicles v ON v.id = b.vehicle_id
       LEFT JOIN pickup_locations pl ON pl.id = b.pickup_location_id
       WHERE b.user_id = ? ORDER BY b.start_date DESC`,
      [req.params.userId]
    );
    const [licenses] = await db.query(
      `SELECT verification_status, updated_at, front_path, back_path
       FROM license_verifications WHERE user_id = ? LIMIT 1`,
      [req.params.userId]
    );
    const license = licenses[0];

    res.json({
      user: users[0],
      bookings,
      license: license ? {
        status: license.verification_status,
        updatedAt: license.updated_at,
        hasFrontPhoto: Boolean(license.front_path),
        hasBackPhoto: Boolean(license.back_path)
      } : { status: 'not_submitted', hasFrontPhoto: false, hasBackPhoto: false }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users/:userId/license/:side', authenticateAdmin, async (req, res) => {
  const column = req.params.side === 'front' ? 'front_path' : req.params.side === 'back' ? 'back_path' : null;
  if (!column) return res.status(400).json({ error: 'Photo side must be front or back' });

  try {
    const [licenses] = await db.query(
      `SELECT ${column} AS photo_path FROM license_verifications WHERE user_id = ? LIMIT 1`,
      [req.params.userId]
    );
    if (!licenses[0]?.photo_path) return res.status(404).json({ error: 'License photo not found' });

    const photoPath = path.join(uploadDirectory, path.basename(licenses[0].photo_path));
    if (!fs.existsSync(photoPath)) return res.status(404).json({ error: 'License photo file is missing' });
    res.sendFile(photoPath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users/:userId/license/review', authenticateAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['verified', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Review status must be verified or rejected' });
  }

  try {
    const [existing] = await db.query(
      'SELECT id FROM license_verifications WHERE user_id = ? LIMIT 1',
      [req.params.userId]
    );
    if (!existing[0]) return res.status(404).json({ error: 'License submission not found' });

    await db.query(
      `UPDATE license_verifications SET verification_status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [status, req.params.userId]
    );
    await db.query(
      `UPDATE bookings SET status = ?
       WHERE user_id = ? AND payment_status = 'unpaid'
         AND status IN ('awaiting_license', 'awaiting_payment', 'license_rejected')`,
      [getReviewBookingStatus(status), req.params.userId]
    );
    res.json({ userId: req.params.userId, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/request-registration-otp', async (req, res) => {
  const { name, email, password, aadhaarId, phone } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedAadhaar = aadhaarId?.replace(/\s/g, '');
  const normalizedPhone = phone?.replace(/\D/g, '');

  if (!name?.trim() || !normalizedEmail || !password || !normalizedAadhaar || !normalizedPhone) {
    return res.status(400).json({ error: 'Name, email, password, Aadhaar ID, and phone number are required' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!/^\d{12}$/.test(normalizedAadhaar)) return res.status(400).json({ error: 'Aadhaar ID must contain 12 digits' });
  if (!/^\d{10}$/.test(normalizedPhone)) return res.status(400).json({ error: 'Phone number must contain 10 digits' });

  try {
    const [existingUsers] = await db.query(
      'SELECT id FROM users WHERE email = ? OR phone = ? OR aadhaar_id = ? LIMIT 1',
      [normalizedEmail, normalizedPhone, normalizedAadhaar]
    );
    if (existingUsers.length > 0) return res.status(409).json({ error: 'An account with this email, phone, or Aadhaar ID already exists' });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    pendingRegistrations.set(normalizedPhone, {
      name: name.trim(), email: normalizedEmail, password, aadhaarId: normalizedAadhaar,
      phone: normalizedPhone, otp, expiresAt: Date.now() + 5 * 60 * 1000
    });
    console.log(`Registration OTP for ${normalizedPhone}: ${otp}`);
    res.json({ message: 'OTP sent to your phone number', ...(process.env.NODE_ENV !== 'production' && { developmentOtp: otp }) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { otp, phone } = req.body;
  const normalizedPhone = phone?.replace(/\D/g, '');
  const pending = pendingRegistrations.get(normalizedPhone);

  if (!pending || pending.expiresAt < Date.now()) {
    pendingRegistrations.delete(normalizedPhone);
    return res.status(400).json({ error: 'OTP expired. Please request a new OTP.' });
  }
  if (pending.otp !== String(otp || '').trim()) return res.status(400).json({ error: 'Invalid OTP' });

  try {
    const passwordHash = await bcrypt.hash(pending.password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, aadhaar_id, phone) VALUES (?, ?, ?, ?, ?)',
      [pending.name, pending.email, passwordHash, pending.aadhaarId, pending.phone]
    );
    pendingRegistrations.delete(normalizedPhone);
    const token = jwt.sign({ userId: result.insertId, email: pending.email }, process.env.JWT_SECRET || 'development-secret');

    return res.status(201).json({
      message: 'Registration successful', token,
      user: { id: result.insertId, name: pending.name, email: pending.email, phone: pending.phone }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email?.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const [users] = await db.query(
      `SELECT u.id, u.name, u.email, u.password,
              COALESCE(lv.verification_status = 'verified', 0) AS license_verified
       FROM users u LEFT JOIN license_verifications lv ON lv.user_id = u.id
       WHERE u.email = ? LIMIT 1`,
      [normalizedEmail]
    );
    const user = users[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'development-secret');
    return res.json({
      message: 'Login successful',
      token,
      licenseVerified: Boolean(user.license_verified),
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/profile', authenticate, async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, name, email, phone, aadhaar_id, created_at FROM users WHERE id = ? LIMIT 1', [req.user.userId]);
    if (!users[0]) return res.status(404).json({ error: 'User not found' });
    res.json(users[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/profile', authenticate, async (req, res) => {
  const name = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase();
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

  try {
    await db.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.user.userId]);
    res.json({ id: req.user.userId, name, email });
  } catch (err) {
    res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.code === 'ER_DUP_ENTRY' ? 'That email is already in use' : err.message });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDirectory),
  filename: (req, file, cb) => cb(null, `${req.user?.userId || 'guest'}-${Date.now()}-${file.fieldname}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }
});

const licenseFields = upload.fields([
  { name: 'licenseFront', maxCount: 1 },
  { name: 'licenseBack', maxCount: 1 }
]);

app.get('/api/license-verification', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT verification_status, updated_at FROM license_verifications WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );
    res.json({ verified: rows[0]?.verification_status === 'verified', status: rows[0]?.verification_status || 'action_needed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/license-verification', authenticate, (req, res, next) => {
  const checkExistingSubmission = async () => {
    const [rows] = await db.query(
      'SELECT verification_status FROM license_verifications WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );
    return rows[0]?.verification_status;
  };

  checkExistingSubmission().then((status) => {
    if (status === 'verified') {
      return res.status(409).json({ error: 'Your license is already verified. You do not need to upload it again.' });
    }
    if (status === 'submitted') {
      return res.status(409).json({ error: 'Your license is awaiting admin review.' });
    }
    licenseFields(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE'
          ? 'Each license photo must be 5 MB or smaller.'
          : 'Only image files can be uploaded for the license photos.';
        return res.status(400).json({ error: message });
      }
      if (err) return next(err);
      next();
    });
  }).catch((err) => res.status(500).json({ error: err.message }));
}, async (req, res) => {
  const files = req.files || {};
  if (!files.licenseFront?.[0] || !files.licenseBack?.[0]) {
    return res.status(400).json({ error: 'Upload both the front and back photos of your license.' });
  }

  try {
    await db.query(
      `INSERT INTO license_verifications (user_id, front_path, back_path, verification_status)
       VALUES (?, ?, ?, 'submitted')
       ON DUPLICATE KEY UPDATE front_path = VALUES(front_path), back_path = VALUES(back_path),
         verification_status = 'submitted', updated_at = CURRENT_TIMESTAMP`,
      [req.user.userId, files.licenseFront[0].path, files.licenseBack[0].path]
    );
    res.status(201).json({ verified: false, status: 'submitted', message: 'Photos received. Their contents are not automatically verified.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/favorites', authenticate, async (req, res) => {
  try {
    const [favorites] = await db.query(
      `SELECT v.* FROM favorite_vehicles f JOIN vehicles v ON v.id = f.vehicle_id
       WHERE f.user_id = ? ORDER BY f.created_at DESC`,
      [req.user.userId]
    );
    res.json(favorites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/favorites/:vehicleId', authenticate, async (req, res) => {
  try {
    await db.query('INSERT IGNORE INTO favorite_vehicles (user_id, vehicle_id) VALUES (?, ?)', [req.user.userId, req.params.vehicleId]);
    res.status(201).json({ favorite: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/favorites/:vehicleId', authenticate, async (req, res) => {
  try {
    await db.query('DELETE FROM favorite_vehicles WHERE user_id = ? AND vehicle_id = ?', [req.user.userId, req.params.vehicleId]);
    res.json({ favorite: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vehicles', async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate || startDate >= endDate) {
    return res.status(400).json({ error: 'A valid startDate and endDate are required' });
  }

  try {
    const [vehicles] = await db.query(
      `SELECT v.* FROM vehicles v
       WHERE NOT EXISTS (
         SELECT 1 FROM bookings b
         WHERE b.vehicle_id = v.id
           AND LOWER(b.status) = 'confirmed'
           AND b.start_date < ?
           AND b.end_date > ?
       )`,
      [endDate, startDate]
    );
    res.json(vehicles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pickup-locations', async (req, res) => {
  const search = `%${String(req.query.search || '').trim()}%`;
  try {
    const [locations] = await db.query(
      `SELECT id, name, address, city, phone, opening_hours, latitude, longitude
       FROM pickup_locations
       WHERE name LIKE ? OR city LIKE ? OR address LIKE ?
       ORDER BY city, name`,
      [search, search, search]
    );
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings', authenticate, async (req, res) => {
  const { vehicleId, pickupLocationId, startDate, endDate, pickupTime, checkoutTime, totalAmount } = req.body;
  const bookingId = `BK-${Date.now().toString().slice(-8)}`;

  if (!vehicleId || !startDate || !endDate || startDate >= endDate || !pickupLocationId || !pickupTime || !checkoutTime) {
    return res.status(400).json({ error: 'Vehicle, valid rental dates, pickup branch, pickup time, and checkout time are required' });
  }

  try {
    const [pickupLocations] = await db.query('SELECT id FROM pickup_locations WHERE id = ? LIMIT 1', [pickupLocationId]);
    if (!pickupLocations[0]) return res.status(400).json({ error: 'Select a valid pickup branch before booking.' });

    const [conflicts] = await db.query(
      `SELECT id FROM bookings
      WHERE vehicle_id = ? AND LOWER(status) = 'confirmed' AND start_date < ? AND end_date > ? LIMIT 1`,
      [vehicleId, endDate, startDate]
    );
    if (conflicts.length > 0) {
      return res.status(409).json({ error: 'This vehicle is no longer available for those dates' });
    }

    const [licenseRows] = await db.query(
      'SELECT verification_status FROM license_verifications WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );
    const initialStatus = getInitialBookingStatus(licenseRows[0]?.verification_status);

    await db.query(
      `INSERT INTO bookings (id, user_id, vehicle_id, pickup_location_id, start_date, end_date, pickup_time, checkout_time, total_amount, deployment_status, status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?, 'unpaid')`,
      [bookingId, req.user.userId, vehicleId, pickupLocationId, startDate, endDate, pickupTime, checkoutTime, totalAmount, initialStatus]
    );
    res.status(201).json({ message: initialStatus === 'awaiting_payment' ? 'Booking created. Continue to payment.' : 'Booking created. Submit your license for admin review.', bookingId, status: initialStatus, paymentStatus: 'unpaid' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings/:bookingId/payment', authenticate, async (req, res) => {
  const cardNumber = String(req.body.cardNumber || '').replace(/\D/g, '');
  const expiry = String(req.body.expiry || '');
  const cvv = String(req.body.cvv || '');
  if (cardNumber.length !== 16 || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry) || !/^\d{3}$/.test(cvv)) {
    return res.status(400).json({ error: 'Enter a valid 16-digit card number, MM/YY expiry, and 3-digit CVV.' });
  }

  const [month, year] = expiry.split('/').map(Number);
  if (new Date(2000 + year, month - 1, 1) < new Date(new Date().getFullYear(), new Date().getMonth(), 1)) {
    return res.status(400).json({ error: 'This card has expired.' });
  }

  try {
    const [licenses] = await db.query(
      'SELECT verification_status FROM license_verifications WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );
    if (licenses[0]?.verification_status !== 'verified') {
      return res.status(403).json({ error: 'An administrator must approve your license before payment.' });
    }

    const [bookings] = await db.query(
      'SELECT id, status, payment_status FROM bookings WHERE id = ? AND user_id = ? LIMIT 1',
      [req.params.bookingId, req.user.userId]
    );
    const booking = bookings[0];
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (booking.status === 'cancelled') return res.status(409).json({ error: 'This booking has been cancelled.' });
    if (booking.payment_status === 'paid') return res.status(409).json({ error: 'This booking has already been paid.' });
    if (booking.status !== 'awaiting_payment') return res.status(409).json({ error: 'This booking is not awaiting payment.' });

    await db.query(
      `UPDATE bookings SET status = 'confirmed', payment_status = 'paid'
       WHERE id = ? AND user_id = ?`,
      [req.params.bookingId, req.user.userId]
    );
    res.json({ bookingId: booking.id, status: 'confirmed', paymentStatus: 'paid', message: 'Demo payment completed. No card details were stored.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bookings', authenticate, async (req, res) => {
  try {
    const [bookings] = await db.query(
            `SELECT b.id, b.start_date, b.end_date, b.pickup_time, b.checkout_time, b.total_amount, b.status, b.deployment_status, b.payment_status,
              v.brand, v.model, v.image_url, pl.name AS pickup_location_name, pl.address AS pickup_location_address,
              pl.city AS pickup_location_city, pl.phone AS pickup_location_phone, pl.opening_hours AS pickup_location_hours
             FROM bookings b JOIN vehicles v ON v.id = b.vehicle_id
             LEFT JOIN pickup_locations pl ON pl.id = b.pickup_location_id
       WHERE b.user_id = ? ORDER BY b.start_date DESC`,
      [req.user.userId]
    );
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/bookings/:bookingId/cancel', authenticate, async (req, res) => {
  try {
    const [result] = await db.query(
      `UPDATE bookings SET status = 'cancelled'
       WHERE id = ? AND user_id = ? AND status <> 'cancelled'`,
      [req.params.bookingId, req.user.userId]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Booking not found or already cancelled' });
    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rentals/log', upload.single('image'), async (req, res) => {
  const { bookingId, vehiclePart, fuelLevel, odometer, latitude, longitude, heading } = req.body;
  const imagePath = req.file ? req.file.path : null;

  try {
    await db.query(
      `INSERT INTO damage_logs 
      (booking_id, vehicle_part, fuel_level, odometer, latitude, longitude, heading, image_path) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [bookingId, vehiclePart, fuelLevel, odometer, latitude, longitude, heading, imagePath]
    );
    res.status(201).json({ message: 'Damage log saved successfully', imagePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
const ensureVehicleColumn = async (definition) => {
  try {
    await db.query(`ALTER TABLE vehicles ADD COLUMN ${definition}`);
  } catch (err) {
    if (err.code !== 'ER_DUP_FIELDNAME') throw err;
  }
};

const ensureVehicleColumns = async () => {
  await Promise.all([
    ensureVehicleColumn('brand VARCHAR(80) NULL'),
    ensureVehicleColumn('model VARCHAR(120) NULL'),
    ensureVehicleColumn('year INT NULL DEFAULT 2025'),
    ensureVehicleColumn('daily_rate DECIMAL(10, 2) NULL DEFAULT 1800'),
    ensureVehicleColumn('seats INT NULL DEFAULT 5'),
    ensureVehicleColumn('fuel_type VARCHAR(30) NULL'),
    ensureVehicleColumn('mileage VARCHAR(30) NULL'),
    ensureVehicleColumn('transmission VARCHAR(30) NULL DEFAULT "Automatic"'),
    ensureVehicleColumn('vehicle_type VARCHAR(50) NULL'),
    ensureVehicleColumn('availability VARCHAR(30) NULL'),
    ensureVehicleColumn('rating DECIMAL(2, 1) NULL'),
    ensureVehicleColumn('image_url TEXT NULL'),
    ensureVehicleColumn('interior_image_url TEXT NULL'),
    ensureVehicleColumn('interior_image_credit VARCHAR(160) NULL'),
    ensureVehicleColumn('interior_image_source_url TEXT NULL'),
    ensureVehicleColumn('interior_image_license VARCHAR(80) NULL'),
    ensureVehicleColumn('exterior_360_frames TEXT NULL'),
    ensureVehicleColumn('interior_360_frames TEXT NULL'),
    ensureVehicleColumn('fuel_level INT NULL DEFAULT 100')
  ]);
};

const seedVehicles = async () => {
  await db.query(`CREATE TABLE IF NOT EXISTS vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    brand VARCHAR(80) NOT NULL,
    model VARCHAR(120) NOT NULL,
    year INT NOT NULL DEFAULT 2025,
    daily_rate DECIMAL(10, 2) NOT NULL DEFAULT 1800,
    seats INT NOT NULL DEFAULT 5,
    fuel_type VARCHAR(30) NOT NULL DEFAULT 'Petrol',
    mileage VARCHAR(30) DEFAULT '15 km/l',
    transmission VARCHAR(30) DEFAULT 'Automatic',
    vehicle_type VARCHAR(50) DEFAULT 'Sedan',
    availability VARCHAR(30) DEFAULT 'Available',
    rating DECIMAL(2, 1) DEFAULT 4.5,
    image_url TEXT,
    fuel_level INT DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY vehicle_model_year (brand, model, year)
  )`);

  const vehicles = [
    { brand: 'Maruti', model: 'Swift Dzire', year: 2025, daily_rate: 1800, seats: 5, fuel_type: 'Petrol', mileage: '22 km/l', transmission: 'Manual', vehicle_type: 'Sedan', availability: 'Available', rating: 4.5, image_url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=80', fuel_level: 100 },
    { brand: 'Hyundai', model: 'Creta', year: 2025, daily_rate: 2600, seats: 5, fuel_type: 'Diesel', mileage: '18 km/l', transmission: 'Automatic', vehicle_type: 'SUV', availability: 'Available', rating: 4.7, image_url: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=900&q=80', interior_image_url: '/vehicle-media/hyundai-creta-interior.jpg', interior_image_credit: "AIMHO'S REBELLION 8490s", interior_image_source_url: 'https://commons.wikimedia.org/wiki/File:2022_Hyundai_Creta_(SU2)_1.5AT_grey_interior_view_in_Brunei.jpg', interior_image_license: 'CC BY-SA 4.0', fuel_level: 100 },
    { brand: 'Kia', model: 'Seltos', year: 2025, daily_rate: 2800, seats: 5, fuel_type: 'Petrol', mileage: '16 km/l', transmission: 'Automatic', vehicle_type: 'SUV', availability: 'Available', rating: 4.6, image_url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=900&q=80', interior_image_url: '/vehicle-media/kia-seltos-interior.jpg', interior_image_credit: "AIMHO'S REBELLION 8490s", interior_image_source_url: 'https://commons.wikimedia.org/wiki/File:2020_KIA_SELTOS_INTERIOR_IN_BRUNEI.jpg', interior_image_license: 'CC BY-SA 4.0', fuel_level: 100 },
    { brand: 'Tata', model: 'Nexon EV', year: 2025, daily_rate: 3200, seats: 5, fuel_type: 'Electric', mileage: '453 km/charge', transmission: 'Automatic', vehicle_type: 'SUV', availability: 'Available', rating: 4.8, image_url: 'https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=900&q=80', fuel_level: 100 },
    { brand: 'Honda', model: 'City', year: 2025, daily_rate: 2400, seats: 5, fuel_type: 'Petrol', mileage: '17 km/l', transmission: 'Automatic', vehicle_type: 'Sedan', availability: 'Available', rating: 4.7, image_url: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?auto=format&fit=crop&w=900&q=80', fuel_level: 100 },
    { brand: 'Mahindra', model: 'XUV700', year: 2025, daily_rate: 4200, seats: 7, fuel_type: 'Diesel', mileage: '14 km/l', transmission: 'Automatic', vehicle_type: 'SUV', availability: 'Available', rating: 4.8, image_url: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=900&q=80', interior_image_url: '/vehicle-media/mahindra-xuv700-interior.png', interior_image_credit: 'DriveSpark', interior_image_source_url: 'https://commons.wikimedia.org/w/index.php?curid=108857669', interior_image_license: 'CC BY 3.0', fuel_level: 100 },
    { brand: 'Toyota', model: 'Innova Crysta', year: 2025, daily_rate: 4500, seats: 7, fuel_type: 'Diesel', mileage: '13 km/l', transmission: 'Automatic', vehicle_type: 'MUV', availability: 'Available', rating: 4.9, image_url: 'https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?auto=format&fit=crop&w=900&q=80', fuel_level: 100 },
    { brand: 'MG', model: 'Comet EV', year: 2025, daily_rate: 1700, seats: 4, fuel_type: 'Electric', mileage: '230 km/charge', transmission: 'Automatic', vehicle_type: 'Hatchback', availability: 'Available', rating: 4.4, image_url: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=900&q=80', interior_image_url: '/vehicle-media/mg-comet-ev-interior.png', interior_image_credit: 'News18 Assam/Northeast', interior_image_source_url: 'https://commons.wikimedia.org/w/index.php?curid=190789988', interior_image_license: 'CC BY 3.0', fuel_level: 100 },
    { brand: 'Renault', model: 'Triber', year: 2025, daily_rate: 1950, seats: 7, fuel_type: 'Petrol', mileage: '19 km/l', transmission: 'Manual', vehicle_type: 'MUV', availability: 'Available', rating: 4.3, image_url: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=900&q=80', fuel_level: 100 },
    { brand: 'Mercedes', model: 'C-Class', year: 2025, daily_rate: 6800, seats: 5, fuel_type: 'Diesel', mileage: '16 km/l', transmission: 'Automatic', vehicle_type: 'Luxury', availability: 'Available', rating: 4.9, image_url: 'https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?auto=format&fit=crop&w=900&q=80', fuel_level: 100 }
  ];

  for (const vehicle of vehicles) {
    await db.query(
      `INSERT INTO vehicles (brand, model, year, daily_rate, seats, fuel_type, mileage, transmission, vehicle_type, availability, rating, image_url, interior_image_url, interior_image_credit, interior_image_source_url, interior_image_license, fuel_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         daily_rate = VALUES(daily_rate),
         seats = VALUES(seats),
         fuel_type = VALUES(fuel_type),
         mileage = VALUES(mileage),
         transmission = VALUES(transmission),
         vehicle_type = VALUES(vehicle_type),
         availability = VALUES(availability),
         rating = VALUES(rating),
         image_url = VALUES(image_url),
         interior_image_url = COALESCE(VALUES(interior_image_url), interior_image_url),
         interior_image_credit = COALESCE(VALUES(interior_image_credit), interior_image_credit),
         interior_image_source_url = COALESCE(VALUES(interior_image_source_url), interior_image_source_url),
         interior_image_license = COALESCE(VALUES(interior_image_license), interior_image_license),
         fuel_level = VALUES(fuel_level)`,
      [
        vehicle.brand,
        vehicle.model,
        vehicle.year,
        vehicle.daily_rate,
        vehicle.seats,
        vehicle.fuel_type,
        vehicle.mileage,
        vehicle.transmission,
        vehicle.vehicle_type,
        vehicle.availability,
        vehicle.rating,
        vehicle.image_url,
        vehicle.interior_image_url || null,
        vehicle.interior_image_credit || null,
        vehicle.interior_image_source_url || null,
        vehicle.interior_image_license || null,
        vehicle.fuel_level
      ]
    );
  }
};

db.query(`CREATE TABLE IF NOT EXISTS license_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    front_path VARCHAR(255) NOT NULL,
    back_path VARCHAR(255) NOT NULL,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'action_needed',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT license_verification_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`)
  .then(async () => {
    await db.query(`CREATE TABLE IF NOT EXISTS license_review_migrations (
      id TINYINT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    const [migration] = await db.query('INSERT IGNORE INTO license_review_migrations (id) VALUES (1)');
    if (migration.affectedRows) {
      await db.query("UPDATE license_verifications SET verification_status = 'submitted' WHERE verification_status = 'verified'");
    }
  })
  .then(() => db.query(`CREATE TABLE IF NOT EXISTS favorite_vehicles (
    user_id INT NOT NULL,
    vehicle_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, vehicle_id),
    CONSTRAINT favorite_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`))
  .then(() => db.query(`CREATE TABLE IF NOT EXISTS pickup_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    opening_hours VARCHAR(120),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    UNIQUE KEY pickup_location_name_city (name, city)
  )`))
  .then(() => db.query(`INSERT IGNORE INTO pickup_locations (name, address, city, phone, opening_hours, latitude, longitude) VALUES
    ('Airport Terminal Branch', 'Kempegowda International Airport, Terminal 1', 'Bengaluru', '+91 80 4000 1100', '06:00 - 23:00', 13.1986, 77.7066),
    ('Central Station Branch', 'Platform Road, Near City Railway Station', 'Bengaluru', '+91 80 4000 1200', '07:00 - 22:00', 12.9777, 77.5707),
    ('Marine Drive Branch', '12 Marine Drive, Fort', 'Mumbai', '+91 22 4000 1300', '07:00 - 22:00', 18.9430, 72.8238),
    ('Connaught Place Branch', 'B-18 Inner Circle, Connaught Place', 'New Delhi', '+91 11 4000 1400', '08:00 - 21:00', 28.6315, 77.2167),
    ('KPHB Branch', 'KPHB Phase 5, Kukatpally', 'Hyderabad', '+91 40 4000 1500', '07:00 - 22:00', 17.4849, 78.3996)
  `))
  .then(() => Promise.all([
    ensureVehicleColumns(),
    ensureVehicleColumn('fuel_type VARCHAR(30) NULL'),
    ensureVehicleColumn('mileage VARCHAR(30) NULL'),
    ensureVehicleColumn('engine_type VARCHAR(80) NULL'),
    ensureVehicleColumn('vehicle_type VARCHAR(50) NULL'),
    ensureVehicleColumn('availability VARCHAR(30) NULL'),
    ensureVehicleColumn('rating DECIMAL(2, 1) NULL')
  ]))
  .then(async () => {
    await db.query(`CREATE TABLE IF NOT EXISTS vehicle_catalog_migrations (
      id TINYINT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    const [migration] = await db.query('INSERT IGNORE INTO vehicle_catalog_migrations (id) VALUES (1)');
    await db.query(`UPDATE vehicles SET
      fuel_type = COALESCE(NULLIF(fuel_type, ''), 'Petrol'),
      mileage = COALESCE(NULLIF(mileage, ''), CASE WHEN seats >= 7 THEN '12 km/l' ELSE '15 km/l' END),
      engine_type = COALESCE(NULLIF(engine_type, ''), CASE WHEN seats >= 7 THEN '2.0L Turbo' ELSE '1.5L Petrol' END),
      vehicle_type = COALESCE(NULLIF(vehicle_type, ''), CASE WHEN seats >= 7 THEN 'SUV' ELSE 'Sedan' END),
      availability = COALESCE(NULLIF(availability, ''), 'Available'),
      rating = COALESCE(rating, 4.5)`);
    if (migration.affectedRows) {
      await db.query('UPDATE vehicles SET daily_rate = ROUND(daily_rate * 1.2, 0)');
    }
    await db.query(`CREATE TABLE IF NOT EXISTS vehicle_price_migrations (
      id TINYINT PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    const [priceMigration] = await db.query('INSERT IGNORE INTO vehicle_price_migrations (id) VALUES (2)');
    if (priceMigration.affectedRows) await db.query('UPDATE vehicles SET daily_rate = GREATEST(ROUND(daily_rate * 10, 0), 1500)');
    await db.query('UPDATE vehicles SET daily_rate = GREATEST(ROUND(daily_rate * 10, 0), 1500) WHERE daily_rate < 1500');
  })
  .then(() => seedVehicles())
  .then(() => db.query("ALTER TABLE users ADD COLUMN aadhaar_id VARCHAR(12) UNIQUE, ADD COLUMN phone VARCHAR(15) UNIQUE"))
  .catch((err) => {
    if (err.code !== 'ER_DUP_FIELDNAME') console.error('Could not ensure registration fields:', err.message);
  })
  .finally(() => db.query("ALTER TABLE bookings ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'confirmed'"))
  .catch((err) => {
    if (err.code !== 'ER_DUP_FIELDNAME') console.error('Could not ensure booking status column:', err.message);
  })
  .finally(() => db.query("ALTER TABLE bookings ADD COLUMN pickup_time TIME NULL, ADD COLUMN deployment_status VARCHAR(30) NOT NULL DEFAULT 'Scheduled'"))
  .catch((err) => {
    if (err.code !== 'ER_DUP_FIELDNAME') console.error('Could not ensure booking pickup fields:', err.message);
  })
  .finally(() => db.query("ALTER TABLE bookings ADD COLUMN checkout_time TIME NULL"))
  .catch((err) => {
    if (err.code !== 'ER_DUP_FIELDNAME') console.error('Could not ensure booking checkout field:', err.message);
  })
  .finally(() => db.query("ALTER TABLE bookings ADD COLUMN pickup_location_id INT NULL"))
  .catch((err) => {
    if (err.code !== 'ER_DUP_FIELDNAME') console.error('Could not ensure booking location field:', err.message);
  })
  .finally(() => db.query("ALTER TABLE bookings ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid'"))
  .catch((err) => {
    if (err.code !== 'ER_DUP_FIELDNAME') console.error('Could not ensure booking payment status field:', err.message);
  })
  .finally(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)));