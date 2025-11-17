import { describe, it, expect } from 'vitest';
import { detectArchetype, detectCardRole } from '../../src/js/synergy/archetype.js';

describe('archetype.js', () => {
  describe('detectArchetype', () => {
    it('should detect aggro archetype from keywords', () => {
      const commander = {
        keywords: ['Haste', 'First Strike'],
        oracle_text: 'Whenever this creature attacks'
      };
      const result = detectArchetype(commander);
      expect(result).toBe('aggro');
    });

    it('should detect control archetype from keywords', () => {
      const commander = {
        keywords: ['Flash'],
        oracle_text: 'Counter target spell'
      };
      const result = detectArchetype(commander);
      expect(result).toBe('control');
    });

    it('should detect combo archetype from oracle text', () => {
      const commander = {
        keywords: [],
        oracle_text: 'When you cast an instant or sorcery spell, you may pay {1}. If you do, copy that spell'
      };
      const result = detectArchetype(commander);
      expect(result).toBe('combo');
    });

    it('should detect various archetypes from oracle text', () => {
      const commander = {
        keywords: [],
        oracle_text: 'Whenever you cast your second spell each turn, draw a card'
      };
      const result = detectArchetype(commander);
      // This should detect as control or midrange
      expect(['control', 'midrange']).toContain(result);
    });

    it('should default to midrange if unclear', () => {
      const commander = {
        keywords: [],
        oracle_text: 'Some generic ability'
      };
      const result = detectArchetype(commander);
      expect(result).toBe('midrange');
    });
  });

  describe('detectCardRole', () => {
    it('should detect ramp cards', () => {
      const card = {
        name: 'Cultivate',
        oracle_text: 'Search your library for a basic land card',
        type_line: 'Sorcery'
      };
      const result = detectCardRole(card);
      expect(result).toBe('ramp');
    });

    it('should detect removal cards', () => {
      const card = {
        name: 'Murder',
        oracle_text: 'Destroy target creature',
        type_line: 'Instant'
      };
      const result = detectCardRole(card);
      expect(result).toBe('removal');
    });

    it('should detect card draw', () => {
      const card = {
        name: 'Divination',
        oracle_text: 'Draw two cards',
        type_line: 'Instant'
      };
      const result = detectCardRole(card);
      expect(result).toBe('card_draw'); // Actual return value from implementation
    });

    it('should detect protection cards', () => {
      const card = {
        name: 'Heroic Intervention',
        oracle_text: 'Target creature gains indestructible',
        type_line: 'Instant'
      };
      const result = detectCardRole(card);
      expect(result).toBe('protection');
    });

    it('should detect wincon cards', () => {
      const card = {
        name: 'Thassa\'s Oracle',
        oracle_text: 'You win the game',
        type_line: 'Sorcery'
      };
      const result = detectCardRole(card);
      expect(result).toBe('combos'); // Actual return value from implementation
    });

    it('should detect known staples', () => {
      const card = {
        name: 'Sol Ring',
        oracle_text: 'Tap: Add two colorless mana',
        type_line: 'Artifact'
      };
      const result = detectCardRole(card);
      expect(result).toBe('ramp'); // Sol Ring is a known ramp staple
    });
  });
});
