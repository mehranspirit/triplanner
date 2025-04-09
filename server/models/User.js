const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password is required only if not using Google auth
    }
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  photoUrl: {
    type: String,
    default: null
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resetToken: String,
  resetTokenExpiry: Date,
  // Google authentication fields
  googleId: {
    type: String,
    sparse: true,
    unique: true
  },
  googleEmail: {
    type: String,
    sparse: true,
    unique: true
  }
}, {
  toJSON: {
    transform: function(doc, ret) {
      ret._id = ret._id;
      ret.isAdmin = ret.isAdmin || false;
      ret.photoUrl = ret.photoUrl || null;
      delete ret.__v;
      delete ret.password;
      delete ret.googleId;
      delete ret.googleEmail;
    }
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  if (this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Set initial admin user
userSchema.statics.initializeAdmin = async function() {
  const adminEmail = 'mehran.rajaian@gmail.com';
  const admin = await this.findOne({ email: adminEmail });
  
  if (admin && !admin.isAdmin) {
    admin.isAdmin = true;
    await admin.save();
    console.log('Admin privileges granted to:', adminEmail);
  }
};

module.exports = mongoose.model('User', userSchema); 