const { generateEmail, sendEmail } = require('./emailOutreach');
const db = require('../db/database');
const dotenv = require('dotenv');

dotenv.config({ override: true });

const database = db.init();

const targets = [
  { name: 'GameStop Cards', email: 'test@test.com', type: 'card_shop' },
  { name: 'Local Pawn Exchange', email: 'test2@test.com', type: 'pawn_shop' },
  { name: 'FB Seller Mike', email: 'test3@test.com', type: 'facebook_seller' },
  { name: 'CardMarket Online', email: 'test4@test.com', type: 'online_seller' }
];

(async () => {
  console.log('Generating sample emails for all 4 target types...\n');

  for (const target of targets) {
    console.log(`--- ${target.type}: ${target.name} ---`);
    try {
      const email = await generateEmail(target, database);
      console.log(`Subject: ${email.subject}`);
      console.log(`Body:\n${email.body}`);
      console.log(`Estimated cost: $${email.estimatedCost.toFixed(6)}`);
    } catch (err) {
      console.error(`  Failed: ${err.message}`);
    }
    console.log('');
  }

  // If --send flag is provided, send a test email
  if (process.argv.includes('--send') && process.env.TEST_EMAIL) {
    console.log(`\nSending test email to ${process.env.TEST_EMAIL}...`);
    try {
      const result = await sendEmail(
        { name: 'Test Recipient', email: process.env.TEST_EMAIL, type: 'card_shop' },
        database
      );
      console.log('Result:', JSON.stringify(result, null, 2));
    } catch (err) {
      console.error(`Send failed: ${err.message}`);
    }
  }

  database.close();
})();
