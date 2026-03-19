import { describe, it, expect } from 'vitest';

const { normalizeCardName, matchesWatchlist, isAccessoryOrFake, classifyListing } = require('../../tools/utils/cardMatcher');
const { sampleWatchlist } = require('../helpers/mockData');

describe('normalizeCardName', () => {
  it('should remove set numbers', () => {
    const result = normalizeCardName('Charizard VMAX 020/189');
    expect(result).not.toContain('020');
    expect(result).not.toContain('189');
  });

  it('should remove filler words', () => {
    const result = normalizeCardName('Pokemon TCG NM Free Shipping');
    expect(result).not.toContain('pokemon');
    expect(result).not.toContain('tcg');
    expect(result).not.toContain('nm');
  });

  it('should preserve card name', () => {
    const result = normalizeCardName('Charizard VMAX Darkness Ablaze');
    expect(result).toContain('charizard');
    expect(result).toContain('vmax');
    expect(result).toContain('darkness');
    expect(result).toContain('ablaze');
  });

  it('should handle all caps', () => {
    expect(normalizeCardName('PIKACHU VMAX')).toBe('pikachu vmax');
  });

  it('should collapse whitespace', () => {
    const result = normalizeCardName('  Umbreon   VMAX  ');
    expect(result).not.toMatch(/\s{2}/);
    expect(result).toBe(result.trim());
  });

  it('should handle special characters', () => {
    const result = normalizeCardName('Charizard VMAX!!! (NM+)');
    expect(result).not.toMatch(/[!()@#$%^&*+]/);
  });
});

describe('matchesWatchlist', () => {
  it('should match exact card name', () => {
    const result = matchesWatchlist('Charizard VMAX', sampleWatchlist);
    expect(result.matched).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(90);
  });

  it('should match with extra words', () => {
    const result = matchesWatchlist('Pokemon Charizard VMAX 020/189 Darkness Ablaze NM', sampleWatchlist);
    expect(result.matched).toBe(true);
    expect(result.watchlistEntry.name).toBe('Charizard VMAX');
  });

  it('should match case-insensitive', () => {
    const result = matchesWatchlist('charizard vmax', sampleWatchlist);
    expect(result.matched).toBe(true);
  });

  it('should not match different card variant', () => {
    const result = matchesWatchlist('Charizard V', sampleWatchlist);
    expect(result.matched).toBe(false);
  });

  it('should not match random text', () => {
    const result = matchesWatchlist('Random Pokemon Lot of Cards', sampleWatchlist);
    expect(result.matched).toBe(false);
  });

  it('should match alt art variants', () => {
    const result = matchesWatchlist('Umbreon VMAX Alternate Art Evolving Skies', sampleWatchlist);
    expect(result.matched).toBe(true);
  });
});

describe('isAccessoryOrFake', () => {
  it('should flag sleeves', () => {
    const result = isAccessoryOrFake('Pokemon Card Sleeves 100 Pack');
    expect(result.isAccessory).toBe(true);
    expect(result.reason).toBe('sleeve');
  });

  it('should flag booster boxes', () => {
    const result = isAccessoryOrFake('Pokemon Booster Box Darkness Ablaze');
    expect(result.isAccessory).toBe(true);
    expect(result.reason).toBe('sealed');
  });

  it('should flag bulk lots', () => {
    const result = isAccessoryOrFake('50 Pokemon Card Lot Bulk');
    expect(result.isAccessory).toBe(true);
    expect(result.reason).toBe('lot');
  });

  it('should flag code cards', () => {
    const result = isAccessoryOrFake('Charizard VMAX PTCGO Code Card');
    expect(result.isAccessory).toBe(true);
    expect(result.reason).toBe('code');
  });

  it('should flag proxies', () => {
    const result = isAccessoryOrFake('Custom Proxy Charizard VMAX');
    expect(result.isAccessory).toBe(true);
    expect(result.reason).toBe('fake');
  });

  it('should NOT flag real cards', () => {
    expect(isAccessoryOrFake('Charizard VMAX 020/189 NM').isAccessory).toBe(false);
  });

  it('should NOT flag real cards with condition', () => {
    expect(isAccessoryOrFake('Pikachu VMAX Near Mint').isAccessory).toBe(false);
  });
});

describe('classifyListing', () => {
  it('should skip accessories', () => {
    const result = classifyListing('Pokemon Card Sleeve Protector', sampleWatchlist);
    expect(result.skip).toBe(true);
    expect(result.reason).toContain('Accessory');
  });

  it('should pass real matching cards', () => {
    const result = classifyListing('Charizard VMAX 020/189 NM', sampleWatchlist);
    expect(result.skip).toBe(false);
    expect(result.watchlistMatch.watchlistEntry.name).toBe('Charizard VMAX');
  });

  it('should skip non-matching cards', () => {
    const result = classifyListing('Random Common Pokemon Card', sampleWatchlist);
    expect(result.skip).toBe(true);
    expect(result.reason).toContain('No watchlist match');
  });
});
