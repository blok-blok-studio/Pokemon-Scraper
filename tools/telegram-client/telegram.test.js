const telegram = require('./telegram');
const dotenv = require('dotenv');

dotenv.config({ override: true });

(async () => {
  console.log('Testing Telegram deal alert...\n');

  const sampleDeal = {
    card_name: 'Charizard VMAX',
    price: 45.00,
    tcg_market_price: 120.00,
    discount_percent: 62.5,
    deal_grade: 'must-buy',
    condition: 'Near Mint',
    source: 'ebay',
    seller_name: 'cardguy99',
    url: 'https://ebay.com/itm/test123',
    ai_summary: 'Great deal on a legitimate listing from established seller',
    red_flags: '[]'
  };

  try {
    await telegram.sendDealAlert(sampleDeal);
    console.log('✓ Deal alert sent successfully');
  } catch (err) {
    console.error(`✗ Failed to send deal alert: ${err.message}`);
    console.error('  Make sure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are set in .env');
  }
})();
