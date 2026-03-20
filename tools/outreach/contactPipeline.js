const fs = require('fs');
const path = require('path');
const { findAllBusinessTypes, searchBusinesses, getBusinessDetails } = require('./businessFinder');
const { findEmail } = require('./emailExtractor');
const { createChildLogger } = require('../logger');

const log = createChildLogger('contact-pipeline');
const CONTACTS_PATH = path.join(__dirname, '..', '..', 'config', 'contacts.json');

function loadContacts() {
  try {
    return JSON.parse(fs.readFileSync(CONTACTS_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveContacts(contacts) {
  fs.writeFileSync(CONTACTS_PATH, JSON.stringify(contacts, null, 2));
}

function isDuplicate(existing, newContact) {
  const newName = newContact.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const newEmail = (newContact.email || '').toLowerCase();

  for (const c of existing) {
    const existName = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (existName === newName) return true;
    if (newEmail && c.email && c.email.toLowerCase() === newEmail) return true;
  }
  return false;
}

/**
 * Full pipeline: search location → find businesses → extract emails → add contacts
 */
async function discoverContacts(location, { types = null, maxPerType = 10, skipEmailExtraction = false } = {}) {
  log.info(`Starting contact discovery for: ${location}`);

  // 1. Find businesses
  const businesses = await findAllBusinessTypes(location, { types, maxPerType });
  log.info(`Found ${businesses.length} businesses`);

  // 2. Load existing contacts for dedup
  const existing = loadContacts();
  log.info(`Existing contacts: ${existing.length}`);

  // 3. Extract emails and add new contacts
  const newContacts = [];
  const noEmail = [];
  const duplicates = [];

  for (const biz of businesses) {
    // Check dedup
    if (isDuplicate(existing, biz)) {
      duplicates.push(biz.name);
      continue;
    }

    let email = null;
    let emailConfidence = null;
    let website = biz.website;

    // If no website from search, try Yelp detail endpoint
    if (!website && biz.yelpId) {
      try {
        const details = await getBusinessDetails(biz.yelpId);
        if (details && details.website) {
          // Yelp returns their own page URL — we need to check if it redirects to actual website
          // For now store the Yelp URL as a fallback
          website = details.website;
        }
        if (details && details.phone && !biz.phone) {
          biz.phone = details.phone;
        }
      } catch (e) {
        log.warn(`Yelp detail fetch failed for ${biz.name}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 500));
    }

    // Try to extract email from website
    if (!skipEmailExtraction && website && !website.includes('yelp.com')) {
      try {
        const result = await findEmail(website);
        if (result) {
          email = result.email;
          emailConfidence = result.confidence;
        }
      } catch (e) {
        log.warn(`Email extraction failed for ${biz.name}: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
    }

    const contact = {
      name: biz.name,
      email: email || null,
      type: biz.type,
      phone: biz.phone || null,
      timezone: null,
      location: biz.address || location,
      website: website || biz.website || null,
      notes: email ? `Email found (${emailConfidence} confidence)` : 'No email found yet',
      rating: biz.rating,
      reviews: biz.reviews,
      discoveredAt: new Date().toISOString(),
      source: 'auto_discovery',
    };

    if (email || contact.phone) {
      newContacts.push(contact);
      existing.push(contact); // Add to existing for dedup of remaining
    } else {
      noEmail.push(contact);
    }
  }

  // 4. Save updated contacts (with email OR phone)
  if (newContacts.length > 0) {
    const allContacts = loadContacts(); // reload fresh
    allContacts.push(...newContacts);
    saveContacts(allContacts);
    const withEmail = newContacts.filter(c => c.email).length;
    const withPhone = newContacts.filter(c => c.phone && !c.email).length;
    log.info(`Added ${newContacts.length} new contacts (${withEmail} with email, ${withPhone} phone-only)`);
  }

  const summary = {
    location,
    businessesFound: businesses.length,
    newWithEmail: newContacts.length,
    noEmailFound: noEmail.length,
    duplicatesSkipped: duplicates.length,
    newContacts: newContacts.map(c => ({ name: c.name, email: c.email, type: c.type })),
    needsManualEmail: noEmail.map(c => ({ name: c.name, website: c.website, phone: c.phone, type: c.type })),
  };

  log.info(`Discovery complete: ${newContacts.length} new contacts, ${noEmail.length} need manual email, ${duplicates.length} duplicates skipped`);

  return summary;
}

/**
 * Search for online sellers (not location-based)
 */
async function discoverOnlineSellers(query, { maxResults = 20 } = {}) {
  log.info(`Searching for online sellers: "${query}"`);

  const businesses = await searchBusinesses(query, 'online', { maxResults });
  const existing = loadContacts();
  const newContacts = [];

  for (const biz of businesses) {
    if (isDuplicate(existing, biz)) continue;
    if (!biz.website) continue;

    const result = await findEmail(biz.website);
    if (result) {
      const contact = {
        name: biz.name,
        email: result.email,
        type: 'online_seller',
        phone: biz.phone || null,
        timezone: null,
        location: null,
        website: biz.website,
        notes: `Online seller, email ${result.confidence} confidence`,
        discoveredAt: new Date().toISOString(),
        source: 'auto_discovery',
      };
      newContacts.push(contact);
      existing.push(contact);
    }

    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
  }

  if (newContacts.length > 0) {
    const allContacts = loadContacts();
    allContacts.push(...newContacts);
    saveContacts(allContacts);
  }

  return {
    query,
    found: businesses.length,
    newWithEmail: newContacts.length,
    contacts: newContacts.map(c => ({ name: c.name, email: c.email })),
  };
}

module.exports = { discoverContacts, discoverOnlineSellers, loadContacts, saveContacts };
