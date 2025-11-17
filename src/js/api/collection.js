/**
 * Collection management API module
 * Handles CRUD operations for user card collections
 * @module api/collection
 */

import { logger } from '../utils/logger.js';
import { getAuthHeaders } from './supabase.js';

// Use current host for API calls
const API_URL = window.location.origin;

// Global collection state
let allCollectionData = [];
let userLimitInfo = {
    max_cards: 500,
    current_count: 0,
    remaining: 500,
    usage_percentage: 0
};

/**
 * Load the user's collection from the server
 *
 * @async
 * @param {Object} options - Loading options
 * @param {number} [options.limit=200] - Max number of cards to load (server max: 200)
 * @param {number} [options.offset=0] - Offset for pagination
 * @returns {Promise<Object[]>} Array of card objects in the collection
 * @throws {Error} If the collection cannot be loaded
 *
 * @example
 * const collection = await loadCollection();
 * console.log(`Loaded ${collection.length} cards`);
 */
export async function loadCollection(options = {}) {
    const { limit = 200, offset = 0 } = options;
    logger.info('Loading collection...', { limit, offset });

    try {
        const url = `${API_URL}/api/collection?limit=${limit}&offset=${offset}`;
        const response = await fetch(url, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Collection load failed:', response.status, errorText);
            throw new Error(`Error al cargar la colección: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Handle new paginated format
        if (data.cards && Array.isArray(data.cards)) {
            allCollectionData = data.cards;

            // Update limit info if provided
            if (data.userLimit) {
                userLimitInfo = data.userLimit;
                logger.info('User limit info updated:', userLimitInfo);
            }
        } else if (Array.isArray(data)) {
            // Backward compatibility: if server returns array directly
            allCollectionData = data;
        } else {
            logger.error('Invalid collection data format');
            throw new Error('La respuesta del servidor no es válida');
        }

        logger.info('Collection loaded:', allCollectionData.length, 'cards');

        return allCollectionData;
    } catch (error) {
        logger.error('Error loading collection:', error);
        throw error;
    }
}

/**
 * Add cards to the collection
 *
 * @async
 * @param {string[]} cardNames - Array of card names to add
 * @returns {Promise<Object>} Result object with added, skipped, errors, and totalInCollection
 * @throws {Error} If the request fails
 *
 * @example
 * const result = await addToCollection(["Sol Ring", "Command Tower"]);
 * console.log(`Added: ${result.added.length}, Duplicates: ${result.skipped.length}`);
 */
export async function addToCollection(cardNames) {
    logger.info('Adding cards to collection:', cardNames.length);

    try {
        const response = await fetch(`${API_URL}/api/collection`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ cardNames })
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Add to collection failed:', response.status, errorText);
            throw new Error(`Error al agregar cartas: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        logger.info('Cards added:', {
            added: result.added.length,
            skipped: result.skipped.length,
            errors: result.errors.length,
            total: result.totalInCollection
        });

        return result;
    } catch (error) {
        logger.error('Error adding to collection:', error);
        throw error;
    }
}

/**
 * Remove a specific card from the collection
 *
 * @async
 * @param {string} cardName - Name of the card to remove
 * @returns {Promise<void>}
 * @throws {Error} If the removal fails
 *
 * @example
 * await removeFromCollection("Lightning Bolt");
 */
export async function removeFromCollection(cardName) {
    logger.info('Removing card from collection:', cardName);

    try {
        const response = await fetch(`${API_URL}/api/collection/${encodeURIComponent(cardName)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            logger.error('Card removal failed:', cardName);
            throw new Error('Error al eliminar la carta');
        }

        logger.info('Card removed successfully:', cardName);
    } catch (error) {
        logger.error('Error removing card:', error);
        throw error;
    }
}

/**
 * Clear the entire collection
 *
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If clearing fails
 *
 * @example
 * await clearCollection();
 */
export async function clearCollection() {
    logger.warn('Clearing entire collection');

    try {
        const response = await fetch(`${API_URL}/api/collection`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            logger.error('Collection clear failed');
            throw new Error('Error al limpiar la colección');
        }

        allCollectionData = [];
        logger.info('Collection cleared successfully');
    } catch (error) {
        logger.error('Error clearing collection:', error);
        throw error;
    }
}

/**
 * Get the cached collection data (without making an API call)
 *
 * @returns {Object[]} Current collection data
 */
export function getCollectionData() {
    return allCollectionData;
}

/**
 * Set the collection data (used by UI components)
 *
 * @param {Object[]} data - Collection data to set
 */
export function setCollectionData(data) {
    allCollectionData = data;
}

/**
 * Get user's card limit information
 *
 * @returns {Object} User limit info with max_cards, current_count, remaining, usage_percentage
 */
export function getUserLimitInfo() {
    return userLimitInfo;
}

/**
 * Fetch latest user limit info from server
 *
 * @async
 * @returns {Promise<Object>} Updated limit info
 */
export async function fetchUserLimit() {
    logger.info('Fetching user limit info...');

    try {
        const response = await fetch(`${API_URL}/api/user/limit`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            logger.error('Failed to fetch user limit');
            return userLimitInfo; // Return cached value
        }

        const data = await response.json();
        userLimitInfo = data;
        logger.info('User limit info fetched:', userLimitInfo);

        return userLimitInfo;
    } catch (error) {
        logger.error('Error fetching user limit:', error);
        return userLimitInfo; // Return cached value on error
    }
}

/**
 * Check if user is close to limit (>= 80%)
 *
 * @returns {boolean} True if user is at 80% or more of their limit
 */
export function isNearLimit() {
    return userLimitInfo.usage_percentage >= 80;
}

/**
 * Check if user has exceeded limit
 *
 * @returns {boolean} True if user is at 100% or more of their limit
 */
export function isAtLimit() {
    return userLimitInfo.usage_percentage >= 100;
}
