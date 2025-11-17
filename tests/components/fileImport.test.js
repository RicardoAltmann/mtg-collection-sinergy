import { describe, it, expect } from 'vitest';
import { parseCSV } from '../../src/js/components/fileImport.js';

describe('fileImport.js', () => {
  describe('parseCSV', () => {
    it('should parse CSV with name column', () => {
      const lines = [
        'name,quantity',
        'Sol Ring,1',
        'Lightning Bolt,4'
      ];
      const result = parseCSV(lines);
      expect(result).toEqual(['Sol Ring', 'Lightning Bolt']);
    });

    it('should parse CSV with Name column (capitalized)', () => {
      const lines = [
        'Name,Quantity',
        'Counterspell,2',
        'Path to Exile,3'
      ];
      const result = parseCSV(lines);
      expect(result).toEqual(['Counterspell', 'Path to Exile']);
    });

    it('should parse CSV with Card column', () => {
      const lines = [
        'Card,Set',
        'Command Tower,CMR',
        'Arcane Signet,ELD'
      ];
      const result = parseCSV(lines);
      expect(result).toEqual(['Command Tower', 'Arcane Signet']);
    });

    it('should handle first column if no name column found', () => {
      const lines = [
        'Mystical Tutor',
        'Vampiric Tutor',
        'Demonic Tutor'
      ];
      const result = parseCSV(lines);
      expect(result).toEqual(['Mystical Tutor', 'Vampiric Tutor', 'Demonic Tutor']);
    });

    it('should skip empty lines', () => {
      const lines = [
        'name',
        'Sol Ring',
        '',
        'Mana Crypt',
        ''
      ];
      const result = parseCSV(lines);
      expect(result).toEqual(['Sol Ring', 'Mana Crypt']);
    });

    it('should handle basic CSV values', () => {
      const lines = [
        'name,type',
        'Atraxa,Legendary Creature',
        'Niv-Mizzet,Legendary Creature'
      ];
      const result = parseCSV(lines);
      expect(result).toEqual(['Atraxa', 'Niv-Mizzet']);
    });
  });
});
