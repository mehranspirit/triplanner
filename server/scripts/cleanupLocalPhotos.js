const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Function to clean up orphaned local photo files
async function cleanupLocalPhotos() {
  try {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    
    // Check if uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      console.log('Uploads directory does not exist. Nothing to clean up.');
      return;
    }

    // Get list of files to be deleted
    const filesToDelete = [];
    
    function findFiles(directory) {
      const files = fs.readdirSync(directory);
      files.forEach(file => {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
          findFiles(fullPath);
        } else {
          filesToDelete.push({
            path: fullPath,
            relativePath: path.relative(uploadsDir, fullPath)
          });
        }
      });
    }
    
    findFiles(uploadsDir);
    
    console.log(`Found ${filesToDelete.length} files in the uploads directory:`);
    filesToDelete.forEach((file, index) => {
      console.log(`${index + 1}. ${file.relativePath}`);
    });

    // Ask for confirmation before deleting
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('\nAre you sure you want to delete these files? (yes/no): ', resolve);
    });

    if (answer.toLowerCase() === 'yes') {
      console.log('\nDeleting files...');
      
      // Delete each file
      let deletedCount = 0;
      for (const file of filesToDelete) {
        try {
          fs.unlinkSync(file.path);
          console.log(`✅ Deleted: ${file.relativePath}`);
          deletedCount++;
        } catch (err) {
          console.error(`❌ Error deleting ${file.relativePath}: ${err.message}`);
        }
      }
      
      console.log(`\nDeleted ${deletedCount} of ${filesToDelete.length} files.`);
      
      // Clean up empty directories
      const photosDir = path.join(uploadsDir, 'photos');
      if (fs.existsSync(photosDir) && fs.readdirSync(photosDir).length === 0) {
        try {
          fs.rmdirSync(photosDir);
          console.log('✅ Removed empty photos directory');
        } catch (err) {
          console.error(`❌ Error removing photos directory: ${err.message}`);
        }
      }
      
      if (fs.existsSync(uploadsDir) && fs.readdirSync(uploadsDir).length === 0) {
        try {
          fs.rmdirSync(uploadsDir);
          console.log('✅ Removed empty uploads directory');
        } catch (err) {
          console.error(`❌ Error removing uploads directory: ${err.message}`);
        }
      }
      
      console.log('\nCleanup completed!');
    } else {
      console.log('\nOperation cancelled. No files were deleted.');
    }
    
    rl.close();
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the function
cleanupLocalPhotos(); 