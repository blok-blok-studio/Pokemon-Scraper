const { previewScript, makeCall, getCallStats } = require('./voiceOutreach');
const db = require('../db/database');
const dotenv = require('dotenv');

dotenv.config({ override: true });

const database = db.init();

const targets = [
  { name: 'Card Kingdom', phone: '+15551234567', type: 'card_shop', timezone: 'America/Denver' },
  { name: 'Quick Pawn', phone: '+15559876543', type: 'pawn_shop', timezone: 'America/New_York' }
];

(async () => {
  console.log('Previewing scripts for each target type...\n');

  for (const target of targets) {
    console.log(`--- ${target.type}: ${target.name} ---`);
    const preview = previewScript(target);
    console.log(`Script: ${preview.script}`);
    console.log(`Business hours: ${preview.businessHours}`);
    console.log(`Estimated cost per call: ~$0.18 (2 min avg)\n`);
  }

  // If --call flag provided, make a test call
  if (process.argv.includes('--call') && process.env.TEST_PHONE) {
    console.log(`\nMaking test call to ${process.env.TEST_PHONE}...`);
    try {
      const result = await makeCall(
        { name: 'Test Call', phone: process.env.TEST_PHONE, type: 'card_shop', timezone: 'America/Denver' },
        database
      );
      console.log('Result:', JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(`Call failed: ${err.message}`);
    }
  }

  database.close();
})();
