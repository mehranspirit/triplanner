const fs = require('fs');
const path = require('path');

function ensureUploadsDir() {
  const uploadsDir = path.join(__dirname, '..', 'uploads', 'photos');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

module.exports = ensureUploadsDir; 