import { describe, it, expect, beforeEach } from 'vitest';

const proxyManager = require('../../tools/scraper-engine/proxyManager');

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

describe('ProxyManager', () => {
  beforeEach(() => setupMockProxies(3));

  it('should rotate through proxies', () => {
    const p1 = proxyManager.getProxy();
    const p2 = proxyManager.getProxy();
    const p3 = proxyManager.getProxy();
    expect(p1).not.toBeNull();
    expect(p2).not.toBeNull();
    expect(p3).not.toBeNull();
  });

  it('should cool down blocked proxy', () => {
    const proxy = proxyManager.getProxy();
    proxyManager.reportBlocked(proxy._proxyUrl);
    const stats = proxyManager.getProxyStats();
    expect(stats.coolingDown).toBe(1);
    expect(stats.available).toBe(2);
  });

  it('should mark proxy as dead after 5 consecutive blocks', () => {
    setupMockProxies(1);
    const state = proxyManager._getStates()[0];
    for (let i = 0; i < 5; i++) proxyManager.reportBlocked(state.url);
    expect(proxyManager.getProxyStats().dead).toBe(1);
  });

  it('should reset consecutive blocks on success', () => {
    setupMockProxies(1);
    const state = proxyManager._getStates()[0];
    proxyManager.reportBlocked(state.url);
    proxyManager.reportBlocked(state.url);
    state.status = 'available';
    state.cooldownUntil = null;
    proxyManager.reportSuccess(state.url);
    expect(state.consecutiveBlocks).toBe(0);
  });

  it('should return null when all proxies unavailable', () => {
    const states = proxyManager._getStates();
    states.forEach(s => { s.status = 'dead'; });
    expect(proxyManager.getProxy()).toBeNull();
  });

  it('should return null with empty config', () => {
    proxyManager._setStates([]);
    expect(proxyManager.getProxy()).toBeNull();
  });
});
