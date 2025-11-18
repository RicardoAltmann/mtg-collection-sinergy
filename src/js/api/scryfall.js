/**
 * Scryfall API integration module
 * Handles all interactions with the Scryfall card database
 * @module api/scryfall
 */

import { logger } from '../utils/logger.js';

// Use current host for API calls (works both locally and in production)
const API_URL = window.location.origin;

/**
 * Fetch data for a single card by name
 *
 * @async
 * @param {string} cardName - Name of the card to fetch
 * @returns {Promise<Object>} Card data object from Scryfall
 * @throws {Error} If card is not found or API request fails
 *
 * @example
 * const card = await fetchCardData("Lightning Bolt");
 * console.log(card.name, card.type_line);
 */
export async function fetchCardData(cardName) {
    logger.debug('Fetching card data:', cardName);

    const response = await fetch(`${API_URL}/api/card/${encodeURIComponent(cardName)}`);

    if (!response.ok) {
        const error = await response.json();
        logger.error('Card fetch failed:', cardName, error);
        throw new Error(error.error || `No se encontró: ${cardName}`);
    }

    const cardData = await response.json();
    logger.debug('Card data fetched:', cardName);

    return cardData;
}

/**
 * Fetch data for multiple cards in a single batch request
 *
 * @async
 * @param {string[]} cardNames - Array of card names to fetch
 * @returns {Promise<Object>} Object containing successful fetches and errors
 * @throws {Error} If the batch request fails
 *
 * @example
 * const cards = await fetchCardsBatch(["Sol Ring", "Command Tower", "Arcane Signet"]);
 * console.log(cards); // { cards: [...], errors: [...] }
 */
export async function fetchCardsBatch(cardNames) {
    logger.info('Fetching batch of cards:', cardNames.length);

    const response = await fetch(`${API_URL}/api/cards/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cardNames })
    });

    if (!response.ok) {
        logger.error('Batch fetch failed');
        throw new Error('Error al buscar cartas');
    }

    const result = await response.json();
    logger.info('Batch fetch complete:', {
        success: result.cards?.length || 0,
        errors: result.errors?.length || 0
    });

    return result;
}

/**
 * Fetch autocomplete suggestions from Scryfall
 * Used for the card search autocomplete feature
 *
 * @async
 * @param {string} query - Search query (minimum 2 characters)
 * @returns {Promise<string[]>} Array of card name suggestions
 * @throws {Error} If the autocomplete request fails
 *
 * @example
 * const suggestions = await fetchAutocompleteSuggestions("light");
 * // Returns: ["Lightning Bolt", "Light Up the Stage", ...]
 */
export async function fetchAutocompleteSuggestions(query) {
    logger.debug('Fetching autocomplete suggestions:', query);

    const response = await fetch(
        `https://api.scryfall.com/cards/autocomplete?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
        logger.error('Autocomplete fetch failed');
        throw new Error('Error fetching suggestions');
    }

    const data = await response.json();
    logger.debug('Autocomplete suggestions received:', data.data?.length || 0);

    return data.data || [];
}

/**
 * Fetch commander-specific autocomplete suggestions
 * Ensures only valid commander cards are returned
 *
 * @async
 * @param {string} query - Search query (minimum 2 characters)
 * @returns {Promise<string[]>} Array of commander name suggestions
 */
export async function fetchCommanderAutocompleteSuggestions(query) {
    logger.debug('Fetching commander autocomplete suggestions:', query);

    const response = await fetch(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`${query} is:commander`)}`
    );

    if (!response.ok) {
        logger.error('Commander autocomplete fetch failed');
        throw new Error('Error fetching commander suggestions');
    }

    const data = await response.json();
    const validCards = (data.data || []).filter(isValidCommanderCard);
    const uniqueNames = [];

    validCards.forEach(card => {
        if (!uniqueNames.includes(card.name)) {
            uniqueNames.push(card.name);
        }
    });

    logger.debug('Commander autocomplete suggestions received:', uniqueNames.length);

    return uniqueNames;
}

function isValidCommanderCard(card) {
    const typeLine = (card.type_line || card.card_faces?.[0]?.type_line || '').toLowerCase();
    const oracleText = (
        card.oracle_text ||
        card.card_faces?.map(face => face.oracle_text).join(' ') ||
        ''
    ).toLowerCase();

    const isLegendaryCreature = typeLine.includes('legendary creature');
    const isCommanderPlaneswalker =
        typeLine.includes('planeswalker') &&
        (oracleText.includes('can be your commander') || oracleText.includes('puede ser tu comandante'));

    return isLegendaryCreature || isCommanderPlaneswalker;
}
