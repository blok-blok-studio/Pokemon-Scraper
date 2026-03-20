#!/usr/bin/env node
const dotenv = require('dotenv');
dotenv.config({ override: true });

const { discoverContacts, discoverOnlineSellers, loadContacts } = require('./contactPipeline');
const { findEmail } = require('./emailExtractor');

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (command === 'find') {
    const location = args[1];
    if (!location) {
      console.error('Usage: node contact-cli.js find "Denver, CO" [--types pawn_shop,thrift_store]');
      process.exit(1);
    }

    const typesIdx = args.indexOf('--types');
    const types = typesIdx > -1 ? args[typesIdx + 1].split(',') : null;

    console.log(`Discovering contacts in: ${location}`);
    if (types) console.log(`Types: ${types.join(', ')}`);

    const result = await discoverContacts(location, { types });
    console.log('\nResults:', JSON.stringify(result, null, 2));

  } else if (command === 'find-online') {
    const queryIdx = args.indexOf('--query');
    const query = queryIdx > -1 ? args[queryIdx + 1] : 'pokemon card store online';

    console.log(`Searching for online sellers: "${query}"`);
    const result = await discoverOnlineSellers(query);
    console.log('\nResults:', JSON.stringify(result, null, 2));

  } else if (command === 'extract-email') {
    const url = args[1];
    if (!url) {
      console.error('Usage: node contact-cli.js extract-email "https://example.com"');
      process.exit(1);
    }

    console.log(`Extracting email from: ${url}`);
    const result = await findEmail(url);
    console.log('Result:', JSON.stringify(result, null, 2));

  } else if (command === 'list') {
    const contacts = loadContacts();
    const byType = {};
    let withEmail = 0;
    let withoutEmail = 0;

    for (const c of contacts) {
      byType[c.type] = (byType[c.type] || 0) + 1;
      if (c.email) withEmail++;
      else withoutEmail++;
    }

    console.log(`Total contacts: ${contacts.length}`);
    console.log(`With email: ${withEmail}`);
    console.log(`Without email: ${withoutEmail}`);
    console.log('\nBy type:');
    for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type}: ${count}`);
    }

  } else {
    console.log(`Usage:
  node contact-cli.js find "Denver, CO" [--types pawn_shop,thrift_store]
  node contact-cli.js find-online --query "pokemon card store"
  node contact-cli.js extract-email "https://example.com"
  node contact-cli.js list`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
