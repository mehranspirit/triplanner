const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const upload = require('../middleware/upload');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client } = require('../utils/s3Config');
const passport = require('../config/passport');

const ADMIN_EMAIL = 'mehran.rajaian@gmail.com';

// Google OAuth routes
router.get('/google',
  (req, res, next) => {
    console.log('Starting Google OAuth flow with:', {
      url: req.url,
      method: req.method,
      headers: req.headers,
      query: req.query,
      params: req.params,
      body: req.body,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? '[SET]' : '[NOT SET]',
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? '[SET]' : '[NOT SET]'
      }
    });
    next();
  },
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })
);

router.get('/google/callback',
  (req, res, next) => {
    console.log('Received Google OAuth callback with:', {
      url: req.url,
      method: req.method,
      headers: req.headers,
      query: req.query,
      params: req.params,
      body: req.body
    });
    next();
  },
  passport.authenticate('google', { 
    failureRedirect: '/login',
    session: false
  }),
  (req, res) => {
    try {
      console.log('Google OAuth authentication successful');
      
      // Generate JWT token
      const token = jwt.sign(
        { userId: req.user._id },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      const frontendURL = process.env.NODE_ENV === 'production'
        ? 'https://triplanner-eight.vercel.app'
        : process.env.FRONTEND_URL;

      // Redirect to frontend with token
      const redirectURL = `${frontendURL}/auth/callback?token=${token}`;
      console.log('Redirecting to:', redirectURL);
      res.redirect(redirectURL);
    } catch (error) {
      console.error('Error in Google OAuth callback handler:', error);
      res.redirect('/login?error=callback_failed');
    }
  }
);

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
        isAdmin: req.user.isAdmin,
        photoUrl: req.user.photoUrl
      }
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Register
router.post('/register', upload.single('photo'), async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      // If a photo was uploaded to S3, delete it
      if (req.file) {
        try {
          const deleteParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: req.file.key
          };
          await s3Client.send(new DeleteObjectCommand(deleteParams));
        } catch (deleteError) {
          console.error('Error deleting file from S3:', deleteError);
        }
      }
      return res.status(400).json({ message: 'Email already registered' });
    }

    const userData = {
      email,
      password,
      name
    };

    // If a photo was uploaded to S3, add the URL to the user data
    if (req.file) {
      userData.photoUrl = req.file.location;
      console.log('Photo uploaded to S3:', {
        key: req.file.key,
        location: req.file.location
      });
    }

    const user = new User(userData);
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ 
      user: { 
        _id: user._id, 
        email: user.email, 
        name: user.name,
        isAdmin: user.isAdmin,
        photoUrl: user.photoUrl
      }, 
      token 
    });
  } catch (error) {
    // If a photo was uploaded to S3, delete it on error
    if (req.file) {
      try {
        const deleteParams = {
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: req.file.key
        };
        await s3Client.send(new DeleteObjectCommand(deleteParams));
      } catch (deleteError) {
        console.error('Error deleting file from S3:', deleteError);
      }
    }
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

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.json({ 
      user: { 
        _id: user._id, 
        email: user.email, 
        name: user.name,
        isAdmin: user.isAdmin,
        photoUrl: user.photoUrl
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
    // Check if the current user is an admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Only admins can access user list' });
    }

    console.log('Fetching users, current user:', {
      userId: req.user._id,
      email: req.user.email,
      isAdmin: req.user.isAdmin
    });
    
    const users = await User.find({}, 'email name createdAt isAdmin photoUrl');
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