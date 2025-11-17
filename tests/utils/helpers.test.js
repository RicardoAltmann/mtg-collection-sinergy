import { describe, it, expect } from 'vitest';
import { extractCreatureTypes, countColorPips } from '../../src/js/utils/helpers.js';

describe('helpers.js', () => {
  describe('extractCreatureTypes', () => {
    it('should extract single creature type (lowercase)', () => {
      const result = extractCreatureTypes('Creature — human wizard');
      expect(result).toEqual(['human', 'wizard']);
    });

    it('should extract multiple creature types (lowercase)', () => {
      const result = extractCreatureTypes('Legendary Creature — dragon knight');
      expect(result).toEqual(['dragon', 'knight']);
    });

    it('should handle non-creature types', () => {
      const result = extractCreatureTypes('Instant');
      expect(result).toEqual([]);
    });

    it('should be case-sensitive', () => {
      const result = extractCreatureTypes('Creature — Dragon Knight');
      expect(result).toEqual([]); // Current implementation is case-sensitive
    });
  });

  describe('countColorPips', () => {
    it('should count single color pips', () => {
      const result = countColorPips('{R}{R}', ['R']);
      expect(result).toBe(2);
    });

    it('should count multiple colors', () => {
      const result = countColorPips('{U}{U}{R}', ['U', 'R']);
      expect(result).toBe(3);
    });

    it('should ignore colorless mana', () => {
      const result = countColorPips('{2}{U}{R}', ['U', 'R']);
      expect(result).toBe(2);
    });

    it('should count each color in hybrid mana separately', () => {
      const result = countColorPips('{R/G}{R/G}', ['R', 'G']);
      expect(result).toBe(4); // R appears twice, G appears twice = 4
    });

    it('should return 0 for no matching colors', () => {
      const result = countColorPips('{W}{W}{W}', ['U', 'B']);
      expect(result).toBe(0);
    });

    it('should handle empty mana cost', () => {
      const result = countColorPips('', ['U']);
      expect(result).toBe(0);
    });
  });
});
