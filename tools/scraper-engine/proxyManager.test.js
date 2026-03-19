const proxyManager = require('./proxyManager');

function setupMockProxies(count = 3) {
  const states = [];
  for (let i = 1; i <= count; i++) {
    states.push({
      url: `http://user${i}:pass${i}@proxy${i}.example.com:8080`,
      label: `Proxy ${i}`,
      type: 'residential',
      status: 'available',
      cooldownUntil: null,
      totalRequests: 0,
      totalBlocks: 0,
      consecutiveBlocks: 0,
      lastUsed: null,
    });
  }
  proxyManager._setStates(states);
}

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

  console.log('\n🔄 Proxy Manager Tests\n');

  // Test 1: Proxy rotation with load balancing
  console.log('Test: proxy rotation');
  setupMockProxies(3);
  const p1 = proxyManager.getProxy();
  const p2 = proxyManager.getProxy();
  const p3 = proxyManager.getProxy();
  assert(p1 !== null, 'getProxy returns non-null');
  assert(p1.label !== p2.label || p2.label !== p3.label, 'rotates through different proxies');
  assert(p1.username === 'user1' || p1.username === 'user2' || p1.username === 'user3', 'parses username correctly');
  assert(p1.password !== null, 'parses password correctly');
  assert(p1._proxyUrl.includes('example.com'), 'includes original URL');

  // Test 2: reportBlocked puts proxy on cooldown
  console.log('\nTest: block cooldown');
  setupMockProxies(3);
  const blocked = proxyManager.getProxy();
  proxyManager.reportBlocked(blocked._proxyUrl);
  const stats1 = proxyManager.getProxyStats();
  assert(stats1.coolingDown === 1, 'one proxy cooling down after reportBlocked');
  assert(stats1.available === 2, 'two proxies still available');

  // Test 3: 5 consecutive blocks marks proxy as dead
  console.log('\nTest: dead after 5 blocks');
  setupMockProxies(1);
  const deadProxy = proxyManager._getStates()[0];
  for (let i = 0; i < 5; i++) {
    proxyManager.reportBlocked(deadProxy.url);
  }
  const stats2 = proxyManager.getProxyStats();
  assert(stats2.dead === 1, 'proxy marked as dead after 5 consecutive blocks');
  assert(stats2.available === 0, 'no available proxies');

  // Test 4: getProxy returns null when all cooling down
  console.log('\nTest: null when all unavailable');
  setupMockProxies(2);
  const states = proxyManager._getStates();
  states[0].status = 'cooling_down';
  states[0].cooldownUntil = Date.now() + 999999;
  states[1].status = 'dead';
  const result = proxyManager.getProxy();
  assert(result === null, 'getProxy returns null when all unavailable');

  // Test 5: reportSuccess resets consecutive blocks
  console.log('\nTest: success resets blocks');
  setupMockProxies(1);
  const successProxy = proxyManager._getStates()[0];
  proxyManager.reportBlocked(successProxy.url);
  proxyManager.reportBlocked(successProxy.url);
  proxyManager.reportBlocked(successProxy.url);
  assert(successProxy.consecutiveBlocks === 3, 'has 3 consecutive blocks');
  // Reset status to available to simulate cooldown expiring
  successProxy.status = 'available';
  successProxy.cooldownUntil = null;
  proxyManager.reportSuccess(successProxy.url);
  assert(successProxy.consecutiveBlocks === 0, 'consecutive blocks reset to 0 after success');

  // Test 6: Empty proxies returns null
  console.log('\nTest: empty config');
  proxyManager._setStates([]);
  const emptyResult = proxyManager.getProxy();
  assert(emptyResult === null, 'getProxy returns null with empty config');

  // Test 7: getProxyStats returns correct structure
  console.log('\nTest: stats structure');
  setupMockProxies(3);
  proxyManager.reportBlocked(proxyManager._getStates()[0].url);
  const stats3 = proxyManager.getProxyStats();
  assert(stats3.total === 3, 'total is 3');
  assert(typeof stats3.available === 'number', 'available is a number');
  assert(Array.isArray(stats3.proxies), 'proxies is an array');
  assert(stats3.proxies[0].label !== undefined, 'proxy has label');

  // Test 8: resetAllProxies
  console.log('\nTest: reset all');
  setupMockProxies(3);
  const allStates = proxyManager._getStates();
  allStates[0].status = 'dead';
  allStates[1].status = 'cooling_down';
  allStates[2].consecutiveBlocks = 4;
  proxyManager.resetAllProxies();
  const stats4 = proxyManager.getProxyStats();
  assert(stats4.available === 3, 'all 3 proxies available after reset');
  assert(stats4.dead === 0, 'no dead proxies after reset');

  // Summary
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\n❌ Some proxy manager tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All proxy manager tests passed');
  }
}

runTests();
