const sampleListings = [
  { source: 'ebay', card_name: 'Charizard VMAX', set_name: 'Darkness Ablaze', condition: 'Near Mint', price: 65, tcg_market_price: 120, discount_percent: 45.8, url: 'https://ebay.com/itm/1001', seller_name: 'CardKing99', deal_grade: 'must-buy', ai_summary: 'Excellent deal on a chase card', red_flags: '[]' },
  { source: 'ebay', card_name: 'Pikachu VMAX', set_name: 'Vivid Voltage', condition: 'Near Mint', price: 38, tcg_market_price: 40, discount_percent: 5.0, url: 'https://ebay.com/itm/1002', seller_name: 'PokeMaster', deal_grade: 'fair', ai_summary: 'Slightly below market', red_flags: '[]' },
  { source: 'tcgplayer_listing', card_name: 'Umbreon VMAX Alt Art', set_name: 'Evolving Skies', condition: 'Near Mint', price: 180, tcg_market_price: 350, discount_percent: 48.6, url: 'https://tcgplayer.com/p/1003', seller_name: 'TopDeckTraders', deal_grade: 'must-buy', ai_summary: 'Great alt art at nearly half price', red_flags: '[]' },
  { source: 'trollandtoad', card_name: 'Lugia V Alt Art', set_name: 'Silver Tempest', condition: 'Near Mint', price: 95, tcg_market_price: 95, discount_percent: 0, url: 'https://trollandtoad.com/p/1004', seller_name: 'Troll and Toad', deal_grade: 'fair', ai_summary: 'At market price', red_flags: '[]' },
  { source: 'ebay', card_name: 'Mew VMAX Alt Art', set_name: 'Fusion Strike', condition: 'Near Mint', price: 3, tcg_market_price: 80, discount_percent: 96.3, url: 'https://ebay.com/itm/1005', seller_name: 'NewSeller_0feedback', deal_grade: 'suspicious', ai_summary: 'Price too good to be true', red_flags: '["Zero feedback seller","Price 96% below market"]' },
  { source: 'ebay', card_name: 'Pokemon Card Sleeves 100 Pack', price: 8, url: 'https://ebay.com/itm/1006', seller_name: 'SupplyShop' },
  { source: 'ebay', card_name: '50 Pokemon Card Lot Bulk Random', price: 15, url: 'https://ebay.com/itm/1007', seller_name: 'BulkDealer' },
  { source: 'ebay', card_name: 'Custom Proxy Charizard VMAX Replica', price: 5, url: 'https://ebay.com/itm/1008', seller_name: 'FakeCards4U' },
  { source: 'ebay', card_name: 'Charizard VMAX', set_name: 'Darkness Ablaze', condition: 'Near Mint', price: 250, tcg_market_price: 120, discount_percent: -108, url: 'https://ebay.com/itm/1009', seller_name: 'ScalperKing', deal_grade: 'overpriced', ai_summary: 'Way above market price', red_flags: '["Price 108% above market"]' },
  { source: 'ebay', card_name: 'Charizard VMAX PTCGO Code Card', price: 0.50, url: 'https://ebay.com/itm/1010', seller_name: 'CodeSeller' },
];

const sampleWatchlist = [
  { name: 'Charizard VMAX', set: 'Darkness Ablaze', maxPrice: 150 },
  { name: 'Pikachu VMAX', set: 'Vivid Voltage', maxPrice: 80 },
  { name: 'Lugia V Alt Art', set: 'Silver Tempest', maxPrice: 200 },
  { name: 'Mew VMAX Alt Art', set: 'Fusion Strike', maxPrice: 120 },
  { name: 'Umbreon VMAX Alt Art', set: 'Evolving Skies', maxPrice: 350 },
];

const sampleContacts = [
  { name: 'GameStop Cards', email: 'gamestop@test.com', type: 'card_shop', phone: null, timezone: null },
  { name: 'Local Pawn Exchange', email: 'pawn@test.com', type: 'pawn_shop', phone: '+15551234567', timezone: 'America/Denver' },
  { name: 'FB Seller Mike', email: 'mike@test.com', type: 'facebook_seller', phone: null, timezone: null },
  { name: 'CardMarket Online', email: 'cardmarket@test.com', type: 'online_seller', phone: null, timezone: null },
];

const sampleOutreach = [
  { target_name: 'GameStop Cards', target_type: 'card_shop', contact_method: 'email', contact_info: 'gamestop@test.com', message_sent: 'Looking for Pokemon cards', status: 'sent' },
  { target_name: 'Local Pawn Exchange', target_type: 'pawn_shop', contact_method: 'email', contact_info: 'pawn@test.com', message_sent: 'Interested in Pokemon cards', status: 'sent' },
  { target_name: 'FB Seller Mike', target_type: 'facebook_seller', contact_method: 'email', contact_info: 'mike@test.com', message_sent: 'Saw your post', status: 'delivered' },
  { target_name: 'CardMarket Online', target_type: 'online_seller', contact_method: 'email', contact_info: 'cardmarket@test.com', message_sent: 'Price inquiry', status: 'replied' },
  { target_name: 'Bad Contact', target_type: 'card_shop', contact_method: 'email', contact_info: 'bad@test.com', message_sent: 'Test email', status: 'failed' },
];

const sampleApiUsage = [
  { service: 'anthropic', endpoint: 'card-analysis', tokens_in: 1000, tokens_out: 500, estimated_cost_usd: 0.01 },
  { service: 'anthropic', endpoint: 'email-generation', tokens_in: 800, tokens_out: 600, estimated_cost_usd: 0.008 },
  { service: 'anthropic', endpoint: 'card-analysis', tokens_in: 2000, tokens_out: 1000, estimated_cost_usd: 0.02 },
  { service: 'resend', endpoint: 'send-email', tokens_in: 0, tokens_out: 0, estimated_cost_usd: 0 },
  { service: 'anthropic', endpoint: 'voice-script', tokens_in: 500, tokens_out: 300, estimated_cost_usd: 0.005 },
];

module.exports = { sampleListings, sampleWatchlist, sampleContacts, sampleOutreach, sampleApiUsage };
