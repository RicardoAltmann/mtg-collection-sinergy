/**
 * Archetype detection and deck balance analysis module
 * Determines commander strategy type and analyzes deck composition
 * @module synergy/archetype
 */

import { logger } from '../utils/logger.js';
import { STAPLES } from '../utils/constants.js';

/**
 * Detect the archetype of a commander
 * Analyzes oracle text, types, and CMC to determine strategy
 *
 * @param {Object} commanderData - Commander card object
 * @returns {string} Archetype name (aggro, control, combo, midrange, ramp, voltron, stax)
 *
 * @example
 * const archetype = detectArchetype(commanderCard);
 * console.log(`Detected archetype: ${archetype}`);
 */
export function detectArchetype(commanderData) {
    const text = (commanderData.oracle_text || '').toLowerCase();
    const types = (commanderData.type_line || '').toLowerCase();
    const cmc = commanderData.cmc || 0;

    let scores = {
        aggro: 0,
        control: 0,
        combo: 0,
        midrange: 0,
        ramp: 0,
        voltron: 0,
        stax: 0
    };

    // AGGRO indicators
    if (text.includes('haste') || text.includes('double strike') || text.includes('first strike')) scores.aggro += 2;
    if (text.includes('attack') && (text.includes('trigger') || text.includes('whenever'))) scores.aggro += 2;
    if (text.includes('combat damage')) scores.aggro += 2;
    if (cmc <= 3 && types.includes('creature')) scores.aggro += 1;
    if (text.includes('token') && text.includes('creature')) scores.aggro += 1;

    // CONTROL indicators
    if (text.includes('counter') && text.includes('spell')) scores.control += 2;
    if (text.includes('return') && text.includes('hand')) scores.control += 2;
    if (text.includes('draw') && text.includes('card')) scores.control += 2;
    if (text.includes('destroy') || text.includes('exile')) scores.control += 1;
    if (cmc >= 5) scores.control += 1;

    // COMBO indicators
    if (text.includes('infinite')) scores.combo += 3;
    if (text.includes('untap') && (text.includes('permanent') || text.includes('artifact'))) scores.combo += 2;
    if (text.includes('copy') && text.includes('spell')) scores.combo += 2;
    if (text.includes('win the game')) scores.combo += 3;
    if (text.includes('search your library')) scores.combo += 1;

    // MIDRANGE indicators
    if (text.includes('enters the battlefield')) scores.midrange += 2;
    if (text.includes('+1/+1 counter')) scores.midrange += 2;
    if (text.includes('whenever') && text.includes('creature')) scores.midrange += 1;
    if (cmc >= 3 && cmc <= 5) scores.midrange += 1;

    // RAMP indicators
    if (text.includes('land') && (text.includes('search') || text.includes('put'))) scores.ramp += 2;
    if (text.includes('mana')) scores.ramp += 2;
    if (text.includes('untap') && text.includes('land')) scores.ramp += 2;
    if (types.includes('land')) scores.ramp += 2;

    // VOLTRON indicators (commander that powers itself up)
    if (text.includes('equip')) scores.voltron += 3;
    if (text.includes('aura')) scores.voltron += 2;
    if (text.includes('commander damage')) scores.voltron += 3;
    if ((text.includes('+x/+x') || text.includes('+1/+1')) && types.includes('creature')) scores.voltron += 2;
    if (text.includes('double') && (text.includes('power') || text.includes('damage'))) scores.voltron += 2;

    // STAX indicators
    if (text.includes('can\'t') || text.includes('cannot')) scores.stax += 2;
    if (text.includes('opponents') && (text.includes('pay') || text.includes('sacrifice'))) scores.stax += 2;
    if (text.includes('tax')) scores.stax += 2;

    // Find the archetype with highest score
    let maxScore = 0;
    let archetype = 'midrange'; // default

    for (const [type, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            archetype = type;
        }
    }

    logger.info('Archetype detected:', archetype, '(score:', maxScore, ')');

    return archetype;
}

/**
 * Detect the role of a card in a deck
 *
 * @param {Object} card - Card object to analyze
 * @returns {string} Role name (ramp, card_draw, removal, etc.)
 *
 * @example
 * const role = detectCardRole(card);
 * console.log(`Card role: ${role}`);
 */
export function detectCardRole(card) {
    const text = (card.oracle_text || '').toLowerCase();
    const types = (card.type_line || '').toLowerCase();
    const cmc = card.cmc || 0;
    const name = card.name.toLowerCase();

    // Check staples first
    for (const [category, cards] of Object.entries(STAPLES)) {
        if (cards.includes(name)) {
            return category;
        }
    }

    // Ramp
    if (cmc <= 3 && (text.includes('add') && text.includes('mana') ||
        text.includes('search') && text.includes('land') ||
        types.includes('artifact') && (text.includes('{t}') || text.includes('tap:')))) {
        return 'ramp';
    }

    // Card draw
    if (text.includes('draw') && (text.includes('card') || text.includes('cards'))) {
        return 'card_draw';
    }

    // Removal
    if (text.includes('destroy') || text.includes('exile') && (text.includes('target') || text.includes('choose'))) {
        return 'removal';
    }

    // Board wipes
    if ((text.includes('destroy all') || text.includes('exile all')) && text.includes('creature')) {
        return 'board_wipes';
    }

    // Tutors
    if (text.includes('search your library') && !text.includes('basic land')) {
        return 'tutors';
    }

    // Counterspells
    if (text.includes('counter target spell')) {
        return 'counterspells';
    }

    // Protection
    if (text.includes('protection') || text.includes('hexproof') || text.includes('indestructible') ||
        text.includes('shroud') || types.includes('equipment') && cmc <= 2) {
        return 'protection';
    }

    // Recursion
    if (text.includes('return') && (text.includes('graveyard') || text.includes('battlefield'))) {
        return 'recursion';
    }

    // Win conditions (payoffs)
    if (cmc >= 6 || text.includes('win the game') || text.includes('infinite')) {
        return 'win_condition';
    }

    // Value engines
    if (text.includes('whenever') || text.includes('at the beginning')) {
        return 'value_engine';
    }

    // Default: threats/creatures
    if (types.includes('creature')) {
        return 'threat';
    }

    return 'utility';
}

/**
 * Analyze collection balance and adjust scores
 * Checks role distribution and mana curve
 *
 * @param {Object[]} scoredCards - Array of scored card objects
 * @param {string} archetype - Detected archetype
 * @returns {Object[]} Adjusted scored cards with balance feedback
 *
 * @example
 * const balanced = analyzeCollectionBalance(scoredCards, 'aggro');
 */
export function analyzeCollectionBalance(scoredCards, archetype) {
    // Count distribution of roles
    const roleCount = {};
    const cmcDistribution = { low: 0, mid: 0, high: 0 };

    scoredCards.forEach(({ card, score, role }) => {
        if (score < 0) return; // Skip out-of-color

        roleCount[role] = (roleCount[role] || 0) + 1;

        const cmc = card.cmc || 0;
        if (cmc <= 2) cmcDistribution.low++;
        else if (cmc <= 5) cmcDistribution.mid++;
        else cmcDistribution.high++;
    });

    logger.debug('Role distribution:', roleCount);
    logger.debug('CMC distribution:', cmcDistribution);

    // Ideal targets based on archetype
    const idealRoles = {
        ramp: { min: 8, max: 14 },
        card_draw: { min: 8, max: 12 },
        removal: { min: 5, max: 10 },
        board_wipes: { min: 2, max: 5 }
    };

    // Adjust based on archetype
    if (archetype === 'aggro') {
        idealRoles.ramp.max = 10;
        idealRoles.removal.min = 3;
    } else if (archetype === 'control') {
        idealRoles.removal.min = 8;
        idealRoles.board_wipes.min = 3;
        idealRoles.card_draw.min = 10;
    } else if (archetype === 'combo') {
        idealRoles.ramp.min = 10;
        idealRoles.card_draw.min = 10;
    }

    // Adjust scores based on balance
    return scoredCards.map(item => {
        let adjustment = 0;
        const { card, role, score } = item;
        const reasons = [...item.reasons];

        // Penalize overload or reward deficit
        if (idealRoles[role]) {
            const current = roleCount[role] || 0;
            if (current > idealRoles[role].max) {
                adjustment -= 5;
                reasons.push(`⚠ Ya tienes suficiente ${role} (${current}/${idealRoles[role].max})`);
            } else if (current < idealRoles[role].min) {
                adjustment += 5;
                reasons.push(`✓ Deck necesita más ${role} (${current}/${idealRoles[role].min})`);
            }
        }

        // Adjust by mana curve
        const cmc = card.cmc || 0;
        const totalCards = scoredCards.filter(s => s.score >= 0).length;

        if (totalCards > 10) {
            if (cmc <= 2 && cmcDistribution.low / totalCards > 0.40) {
                adjustment -= 3;
                reasons.push('⚠ Curva: demasiadas cartas baratas');
            } else if (cmc >= 6 && cmcDistribution.high / totalCards > 0.20) {
                adjustment -= 3;
                reasons.push('⚠ Curva: demasiadas cartas caras');
            } else if (cmc >= 3 && cmc <= 5 && cmcDistribution.mid / totalCards < 0.25) {
                adjustment += 3;
                reasons.push('✓ Curva: necesitas mid-game');
            }
        }

        return {
            ...item,
            score: score + adjustment,
            reasons
        };
    });
}
