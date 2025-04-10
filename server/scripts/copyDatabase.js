const mongoose = require('mongoose');
require('dotenv').config();

// Parse the original URI to get the base and parameters
const originalUri = process.env.MONGODB_URI;
const [baseUri, params] = originalUri.split('?');
const baseWithoutDb = baseUri.substring(0, baseUri.lastIndexOf('/'));

// Construct source and target URIs
const sourceUri = `${baseWithoutDb}/test?${params}`;
const targetUri = `${baseWithoutDb}/prod_test?${params}`;

async function copyDatabase() {
  let sourceConnection, targetConnection;
  
  try {
    console.log('Connecting to source database...');
    sourceConnection = await mongoose.createConnection(sourceUri);
    await sourceConnection.asPromise();
    console.log('Connected to source database');

    console.log('Connecting to target database...');
    targetConnection = await mongoose.createConnection(targetUri);
    await targetConnection.asPromise();
    console.log('Connected to target database');

    // Get all collections from source database
    const collections = await sourceConnection.db.listCollections().toArray();
    console.log(`Found ${collections.length} collections to copy`);

    // Copy each collection
    for (const collection of collections) {
      const collectionName = collection.name;
      console.log(`Copying collection: ${collectionName}`);

      // Get all documents from source collection
      const documents = await sourceConnection.db.collection(collectionName).find({}).toArray();
      console.log(`Found ${documents.length} documents in ${collectionName}`);

      try {
        // Drop the target collection if it exists
        await targetConnection.db.collection(collectionName).drop();
        console.log(`Dropped existing collection: ${collectionName}`);
      } catch (err) {
        // Collection doesn't exist, which is fine
        console.log(`Collection ${collectionName} doesn't exist in target, creating new`);
      }

      // Create the collection and insert documents (even if empty)
      await targetConnection.db.createCollection(collectionName);
      if (documents.length > 0) {
        await targetConnection.db.collection(collectionName).insertMany(documents, { ordered: false });
        console.log(`Copied ${documents.length} documents to ${collectionName}`);
      } else {
        console.log(`Created empty collection: ${collectionName}`);
      }
    }

    console.log('Database copy completed successfully');
  } catch (error) {
    console.error('Error copying database:', error);
  } finally {
    // Close both connections
    if (sourceConnection) await sourceConnection.close();
    if (targetConnection) await targetConnection.close();
    process.exit(0);
  }
}

copyDatabase(); 