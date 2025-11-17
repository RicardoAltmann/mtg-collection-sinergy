/**
 * Concept-based synergy detection module
 * Implements semantic analysis of card mechanics and interactions
 * @module synergy/concepts
 */

import { logger } from '../utils/logger.js';
import { SYNERGY_CONCEPTS } from '../utils/constants.js';

/**
 * Detect synergies based on semantic concepts
 * Matches keywords from both commander and card oracle text
 *
 * @param {Object} card - Card object to analyze
 * @param {Object} commanderData - Commander card object
 * @returns {Object} Object with totalScore and matchedConcepts array
 *
 * @example
 * const synergy = detectConceptSynergies(card, commander);
 * console.log(`Total score: ${synergy.totalScore}`);
 * synergy.matchedConcepts.forEach(c => console.log(c.description));
 */
export function detectConceptSynergies(card, commanderData) {
    const cardText = (card.oracle_text || '').toLowerCase();
    const commanderText = (commanderData.oracle_text || '').toLowerCase();

    let totalScore = 0;
    const matchedConcepts = [];

    Object.entries(SYNERGY_CONCEPTS).forEach(([conceptName, concept]) => {
        let commanderMatches = false;
        let cardMatches = false;

        // Check if commander cares about this concept
        concept.keywords.forEach(keyword => {
            try {
                const regex = new RegExp(keyword, 'i');
                if (regex.test(commanderText)) commanderMatches = true;
                if (regex.test(cardText)) cardMatches = true;
            } catch (e) {
                // Regex invalid, skip
                logger.warn(`Invalid regex: ${keyword}`, e);
            }
        });

        // If both match, it's a synergy!
        if (commanderMatches && cardMatches) {
            totalScore += concept.score;
            matchedConcepts.push({
                name: conceptName,
                description: concept.description,
                score: concept.score
            });

            logger.debug('Concept match:', {
                card: card.name,
                concept: conceptName,
                score: concept.score
            });
        }
    });

    return { totalScore, matchedConcepts };
}

/**
 * Detect advanced anti-synergies (cards that work against your strategy)
 *
 * @param {Object} card - Card object to analyze
 * @param {Object} commanderData - Commander card object
 * @returns {Object[]} Array of penalty objects with score and reason
 *
 * @example
 * const penalties = detectAdvancedAntiSynergies(card, commander);
 * penalties.forEach(p => console.log(p.reason, p.score));
 */
export function detectAdvancedAntiSynergies(card, commanderData) {
    const cardText = (card.oracle_text || '').toLowerCase();
    const commanderText = (commanderData.oracle_text || '').toLowerCase();
    const penalties = [];

    // 1. Commander tax increases
    if (cardText.includes('commander tax') ||
        (cardText.includes('costs') && cardText.includes('more to cast'))) {
        if (commanderData.cmc >= 4) {
            penalties.push({ score: -10, reason: '⚠ Encarece comandante ya costoso' });
        }
    }

    // 2. Graveyard hate vs graveyard strategies
    if ((cardText.includes('exile') || cardText.includes('remove')) &&
        cardText.includes('graveyard')) {
        if (commanderText.includes('graveyard') ||
            commanderText.includes('return') ||
            commanderText.includes('flashback')) {
            penalties.push({ score: -12, reason: '⚠ Invalida estrategia de cementerio' });
        }
    }

    // 3. Can't cast from graveyard
    if (cardText.includes('can\'t cast') && cardText.includes('graveyard')) {
        if (commanderText.includes('flashback') ||
            commanderText.includes('from your graveyard')) {
            penalties.push({ score: -15, reason: '⚠ Bloquea habilidad del comandante' });
        }
    }

    // 4. Sacrifice own creatures vs creature commanders
    if (cardText.includes('sacrifice') && cardText.includes('creature') &&
        (commanderData.type_line || '').toLowerCase().includes('creature')) {
        // Only if it's a forced requirement, not an outlet
        if (cardText.includes('sacrifice a creature') && !cardText.includes('may')) {
            penalties.push({ score: -5, reason: '⚠ Requiere sacrificar criaturas' });
        }
    }

    // 5. Stax pieces that lock out our strategy
    if (cardText.includes('players can\'t') || cardText.includes('can\'t activate')) {
        if (commanderText.includes('activated ability')) {
            penalties.push({ score: -8, reason: '⚠ Bloquea habilidades activadas' });
        }
    }

    // 6. Opposing colors/strategies
    if (cardText.includes('destroy all artifacts')) {
        if ((commanderData.type_line || '').toLowerCase().includes('artifact') ||
            commanderText.includes('artifact')) {
            penalties.push({ score: -10, reason: '⚠ Destruye tus propios artefactos' });
        }
    }

    if (cardText.includes('destroy all enchantments')) {
        if ((commanderData.type_line || '').toLowerCase().includes('enchantment') ||
            commanderText.includes('enchantment')) {
            penalties.push({ score: -10, reason: '⚠ Destruye tus propios encantamientos' });
        }
    }

    if (penalties.length > 0) {
        logger.debug('Anti-synergies detected:', {
            card: card.name,
            penalties: penalties.length
        });
    }

    return penalties;
}
