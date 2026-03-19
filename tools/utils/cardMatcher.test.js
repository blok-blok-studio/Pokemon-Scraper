const { normalizeCardName, matchesWatchlist, isAccessoryOrFake, classifyListing } = require('./cardMatcher');

const sampleWatchlist = [
  { name: 'Charizard VMAX', set: 'Darkness Ablaze', maxPrice: 150 },
  { name: 'Pikachu VMAX', set: 'Vivid Voltage', maxPrice: 80 },
  { name: 'Lugia V Alt Art', set: 'Silver Tempest', maxPrice: 200 },
  { name: 'Mew VMAX Alt Art', set: 'Fusion Strike', maxPrice: 120 },
  { name: 'Umbreon VMAX Alt Art', set: 'Evolving Skies', maxPrice: 350 },
];

function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ ${testName}`);
      failed++;
    }
  }

  console.log('\n🃏 Card Matcher Tests\n');

  // ── normalizeCardName ──
  console.log('normalizeCardName:');

  let result = normalizeCardName('Pokemon TCG Charizard VMAX 020/189 Darkness Ablaze NM Free Shipping!');
  assert(result.includes('charizard') && result.includes('vmax') && result.includes('darkness') && result.includes('ablaze'), 'removes filler, keeps card name + set');
  assert(!result.includes('020') && !result.includes('189'), 'removes set numbers');
  assert(!result.includes('pokemon') && !result.includes('tcg') && !result.includes('nm'), 'removes filler words');

  result = normalizeCardName('CHARIZARD V-MAX Near Mint');
  assert(result.includes('charizard') && result.includes('v-max'), 'handles all caps and hyphens');

  result = normalizeCardName('Pikachu VMAX SV122/SV122 Shining Fates');
  assert(result.includes('pikachu') && result.includes('vmax') && result.includes('shining') && result.includes('fates'), 'removes SV set numbers');

  result = normalizeCardName('   Umbreon   VMAX   Alt   Art   ');
  assert(!result.includes('  '), 'collapses whitespace');
  assert(result === result.trim(), 'trims leading/trailing spaces');

  result = normalizeCardName('Charizard VMAX!!! (NM+)');
  assert(!/[!()@#$%^&*+]/.test(result), 'removes special characters');

  // ── matchesWatchlist ──
  console.log('\nmatchesWatchlist:');

  let match = matchesWatchlist('Charizard VMAX 020/189 Pokemon NM', sampleWatchlist);
  assert(match.matched === true, 'matches Charizard VMAX');
  assert(match.confidence >= 90, `Charizard VMAX confidence >= 90 (got ${match.confidence})`);
  assert(match.watchlistEntry.name === 'Charizard VMAX', 'returns correct watchlist entry');

  match = matchesWatchlist('Pokemon Charizard V card', sampleWatchlist);
  // Charizard V is different from Charizard VMAX
  // The word match would give "charizard" = 1/2 words = 50%, which is below 70
  assert(match.confidence < 70 || match.matched === false, 'does NOT match Charizard V as VMAX');

  match = matchesWatchlist('Umbreon VMAX Alternate Art Evolving Skies', sampleWatchlist);
  assert(match.matched === true, 'matches Umbreon VMAX Alt Art');
  assert(match.confidence >= 70, `Umbreon alt art confidence >= 70 (got ${match.confidence})`);

  match = matchesWatchlist('Random Pokemon Lot', sampleWatchlist);
  assert(match.matched === false, 'does not match random lot');

  match = matchesWatchlist('pikachu vmax vivid voltage nm', sampleWatchlist);
  assert(match.matched === true, 'matches case-insensitive pikachu vmax');
  assert(match.confidence >= 90, `pikachu vmax confidence >= 90 (got ${match.confidence})`);

  match = matchesWatchlist('', sampleWatchlist);
  assert(match.matched === false, 'empty string does not match');

  // ── isAccessoryOrFake ──
  console.log('\nisAccessoryOrFake:');

  let acc = isAccessoryOrFake('Pokemon Card Sleeves 100 Pack');
  assert(acc.isAccessory === true && acc.reason === 'sleeve', 'flags sleeves');

  acc = isAccessoryOrFake('Charizard VMAX NM');
  assert(acc.isAccessory === false, 'does NOT flag real cards');

  acc = isAccessoryOrFake('Pokemon Booster Box Darkness Ablaze');
  assert(acc.isAccessory === true && acc.reason === 'sealed', 'flags booster boxes');

  acc = isAccessoryOrFake('50 Pokemon Card Lot Bulk Random');
  assert(acc.isAccessory === true && acc.reason === 'lot', 'flags bulk lots');

  acc = isAccessoryOrFake('Custom Proxy Charizard VMAX');
  assert(acc.isAccessory === true && acc.reason === 'fake', 'flags proxies/fakes');

  acc = isAccessoryOrFake('Charizard VMAX PTCGO Code Card');
  assert(acc.isAccessory === true && acc.reason === 'code', 'flags code cards');

  acc = isAccessoryOrFake('Pikachu VMAX Near Mint');
  assert(acc.isAccessory === false, 'does NOT flag real cards with condition');

  acc = isAccessoryOrFake('Pokemon Playmat Charizard Design');
  assert(acc.isAccessory === true && acc.reason === 'non_card', 'flags playmats');

  // ── classifyListing ──
  console.log('\nclassifyListing:');

  let cl = classifyListing('Pokemon Card Sleeve Protector', sampleWatchlist);
  assert(cl.skip === true && cl.reason.includes('Accessory'), 'skips accessories');

  cl = classifyListing('Charizard VMAX 020/189 NM', sampleWatchlist);
  assert(cl.skip === false, 'passes real matching cards');
  assert(cl.watchlistMatch.watchlistEntry.name === 'Charizard VMAX', 'links to correct watchlist entry');

  cl = classifyListing('Random Common Pokemon Card', sampleWatchlist);
  assert(cl.skip === true && cl.reason.includes('No watchlist match'), 'skips non-matching cards');

  cl = classifyListing('50 Pokemon Card Lot Bulk', sampleWatchlist);
  assert(cl.skip === true && cl.reason.includes('Accessory'), 'skips lots before checking watchlist');

  // Summary
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\n❌ Some card matcher tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All card matcher tests passed');
  }
}

runTests();
