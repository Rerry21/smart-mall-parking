// backend/routes/adminAuth.js
const express = require('express');
const bcrypt  = require('bcrypt');

module.exports = function adminAuthRouter(db) {
  const router = express.Router();
  const admins = db.collection('admins');

  // POST /api/admin-auth/login
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      // Find admin by username
      const admin = await admins.findOne({ username });
      if (!admin) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Compare hashed password
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Return success — use same token pattern as your existing auth
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { id: admin._id, username: admin.username, role: 'admin' },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '8h' }
      );

      res.json({
        token,
        user: {
          id: admin._id,
          name: admin.username,
          role: 'admin',
        },
      });

    } catch (err) {
      console.error('Admin login error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });

  return router;
};