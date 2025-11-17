/**
 * EDHRec API integration module
 * Provides commander-specific recommendations and synergy data
 * @module api/edhrec
 */

import { logger } from '../utils/logger.js';

/**
 * Fetch EDHRec data for a specific commander
 * Returns top cards and high synergy cards for the commander
 *
 * @async
 * @param {string} commanderName - Name of the commander
 * @returns {Promise<Object>} Object with topCards and highSynergy arrays
 *
 * @example
 * const data = await fetchEDHRecData("Atraxa, Praetors' Voice");
 * console.log(`Top cards: ${data.topCards.length}, High synergy: ${data.highSynergy.length}`);
 */
export async function fetchEDHRecData(commanderName) {
    try {
        // Convert name to slug format (lowercase, hyphens)
        const slug = commanderName.toLowerCase()
            .replace(/[,'']/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        logger.info('Fetching EDHRec data for:', commanderName, `(slug: ${slug})`);

        // Call backend endpoint
        const response = await fetch(`/api/edhrec/${slug}`);

        if (!response.ok) {
            logger.warn(`EDHRec data unavailable for ${commanderName}`);
            return { topCards: [], highSynergy: [] };
        }

        const data = await response.json();
        logger.info(`EDHRec data loaded: ${data.topCards.length} top cards, ${data.highSynergy.length} high synergy`);

        return data;
    } catch (error) {
        logger.warn('EDHRec fetch error:', error);
        return { topCards: [], highSynergy: [] };
    }
}

/**
 * Apply EDHRec-based boost to a card's synergy score
 * Checks if the card appears in EDHRec's recommendations
 *
 * @param {Object} card - Card object to check
 * @param {string} card.name - Name of the card
 * @param {Object} edhrecData - EDHRec data containing topCards and highSynergy
 * @param {Array} edhrecData.topCards - Array of top cards with inclusion rates
 * @param {Array} edhrecData.highSynergy - Array of high synergy cards
 * @returns {Object} Object with boost score and reasons array
 *
 * @example
 * const boost = applyEDHRecBoost(card, edhrecData);
 * console.log(`Boost: +${boost.boost}`, boost.reasons);
 */
export function applyEDHRecBoost(card, edhrecData) {
    if (!edhrecData || (!edhrecData.topCards?.length && !edhrecData.highSynergy?.length)) {
        return { boost: 0, reasons: [] };
    }

    const cardName = card.name.toLowerCase();
    let boost = 0;
    const reasons = [];

    // High synergy cards (higher priority)
    const synergyCard = edhrecData.highSynergy.find(c => c.name === cardName);
    if (synergyCard) {
        boost += 25;
        reasons.push('✓ Alta sinergia según EDHRec (+25)');
    }

    // Top cards (normalized by percentile)
    const topCard = edhrecData.topCards.find(c => c.name === cardName);
    if (topCard && edhrecData.topCards.length > 0) {
        // Calculate percentile
        const maxInclusion = Math.max(...edhrecData.topCards.map(c => c.inclusion));
        if (maxInclusion > 0) {
            const percentile = topCard.inclusion / maxInclusion;

            // Top 10% = +20, top 25% = +15, top 50% = +10, rest = +5
            if (percentile >= 0.9) {
                boost += 20;
                reasons.push('✓ Top 10% EDHRec (+20)');
            } else if (percentile >= 0.75) {
                boost += 15;
                reasons.push('✓ Top 25% EDHRec (+15)');
            } else if (percentile >= 0.5) {
                boost += 10;
                reasons.push('✓ Top 50% EDHRec (+10)');
            } else {
                boost += 5;
                reasons.push('✓ Popular en EDHRec (+5)');
            }
        }
    }

    return { boost, reasons };
}
