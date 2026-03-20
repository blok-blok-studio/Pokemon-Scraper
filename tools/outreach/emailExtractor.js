const { launchBrowser } = require('../scraper-engine/browserLauncher');
const { createChildLogger } = require('../logger');

const log = createChildLogger('email-extractor');

// Emails to skip — generic/useless addresses
const SKIP_PREFIXES = [
  'noreply', 'no-reply', 'donotreply', 'do-not-reply',
  'mailer-daemon', 'postmaster', 'webmaster',
  'abuse', 'spam', 'unsubscribe',
  'newsletter', 'marketing', 'notifications',
  'admin@wordpress', 'admin@shopify',
];

// Email regex — matches most valid emails
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function isValidEmail(email) {
  if (!email || email.length > 100) return false;
  email = email.toLowerCase();

  // Skip generic addresses
  for (const prefix of SKIP_PREFIXES) {
    if (email.startsWith(prefix)) return false;
  }

  // Skip image extensions that look like emails
  if (email.match(/\.(png|jpg|jpeg|gif|svg|css|js)$/)) return false;

  // Must have a real TLD
  if (!email.match(/@[a-z0-9.-]+\.[a-z]{2,}$/)) return false;

  return true;
}

function scoreEmail(email, pageUrl) {
  email = email.toLowerCase();
  let score = 50; // base

  // Prefer personal-sounding emails
  if (email.match(/^(owner|contact|hello|hi|hey|shop|store|sales|buy)/)) score += 20;
  if (email.match(/^(info@)/)) score += 10; // info@ is okay, not great
  if (email.match(/^(support@|help@)/)) score -= 10; // support is less useful

  // Prefer emails matching the business domain
  try {
    const siteDomain = new URL(pageUrl).hostname.replace('www.', '');
    const emailDomain = email.split('@')[1];
    if (emailDomain === siteDomain) score += 30; // same domain = very good
  } catch {}

  // Prefer emails found on contact pages
  if (pageUrl.includes('contact') || pageUrl.includes('about')) score += 15;

  return score;
}

/**
 * Extract emails from a single webpage
 */
async function extractEmailsFromPage(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await new Promise(r => setTimeout(r, 1500));

    const emails = await page.evaluate((regex) => {
      const found = new Set();

      // Check mailto links first (highest confidence)
      const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
      for (const link of mailtoLinks) {
        const email = link.href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
        if (email) found.add(email);
      }

      // Check page text content
      const bodyText = document.body ? document.body.innerText : '';
      const matches = bodyText.match(new RegExp(regex, 'g')) || [];
      for (const m of matches) {
        found.add(m.toLowerCase());
      }

      // Check meta tags
      const metas = document.querySelectorAll('meta[content]');
      for (const meta of metas) {
        const content = meta.getAttribute('content') || '';
        const metaMatches = content.match(new RegExp(regex, 'g')) || [];
        for (const m of metaMatches) found.add(m.toLowerCase());
      }

      return Array.from(found);
    }, EMAIL_REGEX.source);

    return emails.filter(isValidEmail).map(email => ({
      email,
      score: scoreEmail(email, url),
      foundOn: url,
    }));
  } catch (e) {
    log.warn(`Failed to extract from ${url}: ${e.message}`);
    return [];
  }
}

/**
 * Find email for a business by scraping their website
 */
async function findEmail(websiteUrl, { timeout = 30000 } = {}) {
  let browser;
  try {
    if (!websiteUrl) return null;

    // Clean up URL
    let baseUrl = websiteUrl;
    if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;

    log.info(`Extracting email from: ${baseUrl}`);
    browser = await launchBrowser();
    const page = await browser.newPage();

    const allEmails = [];

    // 1. Check homepage
    const homeEmails = await extractEmailsFromPage(page, baseUrl);
    allEmails.push(...homeEmails);

    // 2. Try common contact pages
    const contactPaths = ['/contact', '/contact-us', '/about', '/about-us', '/connect'];
    for (const path of contactPaths) {
      try {
        const url = new URL(path, baseUrl).toString();
        const emails = await extractEmailsFromPage(page, url);
        allEmails.push(...emails);
      } catch {}
      if (allEmails.length > 0) break; // found emails, stop searching
    }

    // 3. If still nothing, look for contact links on the homepage
    if (allEmails.length === 0) {
      try {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const contactLinks = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href]'));
          return links
            .filter(l => {
              const text = (l.textContent + ' ' + l.href).toLowerCase();
              return text.includes('contact') || text.includes('email') || text.includes('reach');
            })
            .map(l => l.href)
            .slice(0, 3);
        });

        for (const link of contactLinks) {
          if (link.startsWith('mailto:')) {
            const email = link.replace('mailto:', '').split('?')[0].trim().toLowerCase();
            if (isValidEmail(email)) {
              allEmails.push({ email, score: 90, foundOn: baseUrl });
            }
          } else if (link.startsWith('http')) {
            const emails = await extractEmailsFromPage(page, link);
            allEmails.push(...emails);
          }
        }
      } catch {}
    }

    // Dedup and pick best
    const seen = new Set();
    const unique = allEmails.filter(e => {
      if (seen.has(e.email)) return false;
      seen.add(e.email);
      return true;
    });

    unique.sort((a, b) => b.score - a.score);

    if (unique.length === 0) {
      log.info(`No email found for ${baseUrl}`);
      return null;
    }

    const best = unique[0];
    const confidence = best.score >= 70 ? 'high' : best.score >= 40 ? 'medium' : 'low';
    log.info(`Found email for ${baseUrl}: ${best.email} (confidence: ${confidence})`);

    return {
      email: best.email,
      confidence,
      score: best.score,
      foundOn: best.foundOn,
      alternates: unique.slice(1, 3).map(e => e.email),
    };
  } catch (err) {
    log.error(`Email extraction failed for ${websiteUrl}: ${err.message}`);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { findEmail, extractEmailsFromPage, isValidEmail };
