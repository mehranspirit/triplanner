# Migration Scripts

This directory contains migration scripts for the Triplanner application.

## Event Creator Migration

The `migrateEventCreators.js` script adds creator and updater information to existing events in the database. This ensures that even if activity logs are deleted, the basic information about who created and last modified an event is preserved.

### What the Script Does

1. Finds all trips in the database
2. For each trip, processes all events
3. For each event:
   - Checks if it already has creator information (skips if it does)
   - Looks up the creation activity in the activity log
   - If found, sets the creator and updater information from the activity
   - If not found, uses the trip owner as a fallback
4. Saves the updated trips

### Running the Script

To run the migration script:

```bash
# Make sure you're in the project root directory
cd /path/to/triplanner

# Run the script
node server/scripts/migrateEventCreators.js
```

### Output

The script will output progress information as it runs:

- Number of trips found
- For each trip, the number of events processed
- For each event, whether it was updated or skipped
- Summary statistics at the end

### Important Notes

- The script is idempotent - it can be run multiple times without duplicating data
- Events that already have creator information will be skipped
- If no activity log entry is found for an event, the trip owner will be used as the creator
- The script requires a connection to the MongoDB database, so make sure your `.env` file is properly configured 