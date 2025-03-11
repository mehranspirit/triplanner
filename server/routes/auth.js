const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const ADMIN_EMAIL = 'mehran.rajaian@gmail.com';

// Validate token
router.get('/validate', auth, async (req, res) => {
  try {
    // If we get here, it means the auth middleware passed
    // and the token is valid
    res.json({ 
      valid: true,
      user: {
        _id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        isAdmin: req.user.isAdmin
      }
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Change user role (protected route, admin only)
router.patch('/users/:userId/role', auth, async (req, res) => {
  try {
    // Check if the current user is the main admin
    if (req.user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ message: 'Only the main admin can change user roles' });
    }

    const { userId } = req.params;
    const { isAdmin } = req.body;

    // Find the user to update
    const userToUpdate = await User.findById(userId);
    
    if (!userToUpdate) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Don't allow changing the main admin's role
    if (userToUpdate.email === ADMIN_EMAIL) {
      return res.status(403).json({ message: 'Cannot change the main admin\'s role' });
    }

    // Update the user's role
    userToUpdate.isAdmin = isAdmin;
    await userToUpdate.save();

    res.json({ 
      message: 'User role updated successfully',
      user: {
        _id: userToUpdate._id,
        email: userToUpdate.email,
        name: userToUpdate.name,
        isAdmin: userToUpdate.isAdmin
      }
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Error updating user role' });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = new User({ email, password, name });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.status(201).json({ user: { _id: user._id, email: user.email, name: user.name }, token });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);
    res.json({ 
      user: { 
        _id: user._id, 
        email: user.email, 
        name: user.name,
        isAdmin: user.isAdmin 
      }, 
      token 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get list of users (protected route)
router.get('/users', auth, async (req, res) => {
  try {
    // Check if the current user is the main admin
    if (req.user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ message: 'Only the main admin can access user list' });
    }

    console.log('Fetching users, current user:', {
      userId: req.user._id,
      email: req.user.email,
      isAdmin: req.user.isAdmin
    });
    
    const users = await User.find({}, 'email name createdAt isAdmin');
    console.log('Users found:', users);
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: error.message });
  }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    // Save reset token and expiry to user
    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });

    // Reset link
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Email options
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <p>You requested a password reset</p>
        <p>Click this <a href="${resetLink}">link</a> to reset your password</p>
        <p>This link will expire in 1 hour</p>
        <p>If you did not request this, please ignore this email</p>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.json({ message: 'Password reset link sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Error sending reset email' });
  }
});

// Reset Password
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Find user with valid reset token
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    
    // Clear reset token fields
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Error resetting password' });
  }
});

module.exports = router; 