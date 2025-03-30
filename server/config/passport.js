require('dotenv').config();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Construct the callback URL based on environment
const callbackURL = process.env.NODE_ENV === 'production'
  ? 'https://triplanner-backend.onrender.com/api/auth/google/callback'
  : 'http://localhost:3000/api/auth/google/callback';

// Debug logging
console.log('Loading passport configuration with:', {
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET ? '[SECRET]' : undefined,
  callbackURL,
  nodeEnv: process.env.NODE_ENV
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL,
    proxy: true
  },
  async function(accessToken, refreshToken, profile, done) {
    try {
      // Check if user already exists
      let user = await User.findOne({ googleId: profile.id });

      if (!user) {
        // Check if user exists with the same email
        user = await User.findOne({ email: profile.emails[0].value });
        
        if (user) {
          // Link Google account to existing user
          user.googleId = profile.id;
          user.googleEmail = profile.emails[0].value;
          await user.save();
        } else {
          // Create new user
          user = await User.create({
            googleId: profile.id,
            googleEmail: profile.emails[0].value,
            email: profile.emails[0].value,
            name: profile.displayName,
            photoUrl: profile.photos[0]?.value || null
          });
        }
      }

      return done(null, user);
    } catch (error) {
      console.error('Error in Google OAuth callback:', error);
      return done(error, null);
    }
  }
));

// Serialize user for the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport; 