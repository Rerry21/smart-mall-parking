// backend/routes/auth.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const User    = require('../models/User');

const router = express.Router();

// Demo OTP — hardcoded for presentation purposes
const DEMO_OTP = '1234';

module.exports = (db) => {
  const userModel = new User(db);

  // ────────────────────────────────
  //  REGISTER
  // ────────────────────────────────
  router.post('/register', async (req, res) => {
    try {
      const { name, phone, password, role, plateNumber } = req.body;

      if (!name || !phone || !password || !role) {
        return res.status(400).json({ message: 'All fields are required' });
      }
      if (!['driver', 'watchman'].includes(role)) {
        return res.status(400).json({ message: 'Only driver and watchman can register' });
      }
      if (role === 'driver' && !plateNumber) {
        return res.status(400).json({ message: 'Car plate number is required for drivers' });
      }

      const existingUser = await userModel.findByPhone(phone);
      if (existingUser) {
        return res.status(400).json({ message: 'User with this phone number already exists' });
      }

      const userData = { name, phone, password, role };
      if (plateNumber) userData.plateNumber = plateNumber.toUpperCase();

      const newUser = await userModel.create(userData);

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        user: {
          id:          newUser._id,
          name:        newUser.name,
          phone:       newUser.phone,
          role:        newUser.role,
          plateNumber: newUser.plateNumber || null,
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error during registration' });
    }
  });

  // ────────────────────────────────
  //  LOGIN
  // ────────────────────────────────
  router.post('/login', async (req, res) => {
    try {
      const { phone, password, role } = req.body;

      if (!phone || !password) {
        return res.status(400).json({ message: 'Phone and password are required' });
      }

      const user = await userModel.findByPhone(phone);
      if (!user) {
        return res.status(400).json({ message: 'User not found' });
      }

      const isMatch = await userModel.comparePassword(user.password, password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect password' });
      }

      if (role && user.role !== role) {
        return res.status(400).json({ message: 'Role does not match' });
      }

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id:           user._id,
          name:         user.name,
          phone:        user.phone,
          role:         user.role,
          plateNumber:  user.plateNumber  || null,
          profilePhoto: user.profilePhoto || null,
        },
        token: 'demo-token-' + Date.now()   // TODO: Replace with real JWT later
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error during login' });
    }
  });

  // ────────────────────────────────
  //  FORGOT PASSWORD — Step 1
  //  Check phone exists in DB
  // ────────────────────────────────
  router.post('/forgot-password', async (req, res) => {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({ message: 'Phone number is required' });
      }

      const user = await userModel.findByPhone(phone);
      if (!user) {
        return res.status(404).json({ message: 'No account found with that phone number' });
      }

      // In production: generate real OTP, send via SMS here
      // For demo: OTP is always 1234, no SMS sent
      console.log(`[DEMO] OTP for ${phone}: ${DEMO_OTP}`);

      res.json({
        success: true,
        message: 'OTP sent to your phone number',
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // ────────────────────────────────
  //  VERIFY OTP — Step 2
  //  Always accepts 1234 for demo
  // ────────────────────────────────
  router.post('/verify-otp', async (req, res) => {
    try {
      const { phone, otp } = req.body;

      if (!phone || !otp) {
        return res.status(400).json({ message: 'Phone and OTP are required' });
      }

      // Verify phone still exists
      const user = await userModel.findByPhone(phone);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Demo OTP check
      if (otp !== DEMO_OTP) {
        return res.status(400).json({ message: 'Invalid OTP. Please try again.' });
      }

      res.json({
        success: true,
        message: 'OTP verified successfully',
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  // ────────────────────────────────
  //  RESET PASSWORD — Step 3
  //  Update password in DB
  // ────────────────────────────────
  router.post('/reset-password', async (req, res) => {
    try {
      const { phone, newPassword } = req.body;

      if (!phone || !newPassword) {
        return res.status(400).json({ message: 'Phone and new password are required' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      }

      const user = await userModel.findByPhone(phone);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Hash the new password
      const salt           = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      await db.collection('users').updateOne(
        { phone },
        { $set: { password: hashedPassword } }
      );

      res.json({
        success: true,
        message: 'Password reset successfully',
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error during password reset' });
    }
  });

  // ────────────────────────────────
  //  UPDATE PROFILE
  // ────────────────────────────────
  router.put('/update-profile', async (req, res) => {
    try {
      const { userId, phone, plateNumber, profilePhoto, currentPassword, newPassword } = req.body;

      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      const { ObjectId } = require('mongodb');
      const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const updates = {};

      if (phone) {
        const existingPhone = await userModel.findByPhone(phone);
        if (existingPhone && existingPhone._id.toString() !== userId) {
          return res.status(400).json({ message: 'Phone number already in use' });
        }
        updates.phone = phone;
      }

      if (plateNumber)              updates.plateNumber  = plateNumber.toUpperCase();
      if (profilePhoto !== undefined) updates.profilePhoto = profilePhoto;

      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ message: 'Current password is required' });
        }
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
          return res.status(400).json({ message: 'Current password is incorrect' });
        }
        const salt           = await bcrypt.genSalt(10);
        updates.password     = await bcrypt.hash(newPassword, salt);
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No updates provided' });
      }

      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: updates }
      );

      const updatedUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id:           updatedUser._id,
          name:         updatedUser.name,
          phone:        updatedUser.phone,
          role:         updatedUser.role,
          plateNumber:  updatedUser.plateNumber  || null,
          profilePhoto: updatedUser.profilePhoto || null,
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error during profile update' });
    }
  });

  return router;
};