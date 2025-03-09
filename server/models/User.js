const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
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
  resetTokenExpiry: Date
}, {
  toJSON: {
    transform: function(doc, ret) {
      ret._id = ret._id;
      ret.isAdmin = ret.isAdmin || false;
      delete ret.__v;
      delete ret.password;
    }
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
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