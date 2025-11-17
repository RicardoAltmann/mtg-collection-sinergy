/**
 * User feedback utilities for tuning synergy heuristics.
 * Allows storing lightweight preferences that adjust how the engine interprets
 * certain rules (e.g., what counts as a permanent) based on real-world input.
 * @module utils/feedback
 */

import { BASE_PERMANENT_TYPES } from './helpers.js';

const FEEDBACK_STORAGE_KEY = 'synergy_feedback';

const DEFAULT_FEEDBACK = {
    permanentTypes: BASE_PERMANENT_TYPES,
    weights: {
        coloredPermanent: 4
    },
    // Aggregate thumbs-up/down per card so feedback isn't a manual form per card
    // but a lightweight signal the engine can learn from over time.
    cardSignals: {}
};

function sanitizePermanentTypes(permanentTypes) {
    if (!Array.isArray(permanentTypes)) return BASE_PERMANENT_TYPES;
    const cleaned = permanentTypes
        .map(type => typeof type === 'string' ? type.trim().toLowerCase() : '')
        .filter(Boolean);
    return cleaned.length > 0 ? cleaned : BASE_PERMANENT_TYPES;
}

/**
 * Load user feedback preferences from localStorage, falling back to defaults.
 * Gracefully handles invalid or missing data.
 *
 * @returns {Object} Feedback configuration with permanent types and weights
 */
export function loadFeedbackPreferences() {
    if (typeof localStorage === 'undefined') {
        return DEFAULT_FEEDBACK;
    }

    try {
        const saved = localStorage.getItem(FEEDBACK_STORAGE_KEY);
        if (!saved) return DEFAULT_FEEDBACK;

        const parsed = JSON.parse(saved);
        return {
            ...DEFAULT_FEEDBACK,
            ...parsed,
            permanentTypes: sanitizePermanentTypes(parsed?.permanentTypes),
            cardSignals: parsed?.cardSignals || {}
        };
    } catch (error) {
        console.warn('Failed to read synergy feedback, using defaults', error);
        return DEFAULT_FEEDBACK;
    }
}

/**
 * Persist feedback preferences so future analyses can leverage user insights.
 *
 * @param {Object} updates - Partial feedback object to merge into saved data
 */
export function saveFeedbackPreferences(updates) {
    if (typeof localStorage === 'undefined') return;

    try {
        const current = loadFeedbackPreferences();
        const merged = {
            ...current,
            ...updates,
            permanentTypes: sanitizePermanentTypes(updates?.permanentTypes ?? current.permanentTypes),
            cardSignals: updates?.cardSignals ?? current.cardSignals ?? {}
        };
        localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(merged));
    } catch (error) {
        console.warn('Failed to save synergy feedback', error);
    }
}

/**
 * Record a lightweight thumbs-up or thumbs-down for a specific card.
 * Multiple inputs accumulate, so users don't need to fill a form per card.
 *
 * @param {string} cardName - Name of the card
 * @param {'up'|'down'} signal - Whether the user liked (up) or disliked (down) the suggestion
 */
export function recordCardSignal(cardName, signal) {
    if (typeof localStorage === 'undefined' || !cardName || !['up', 'down'].includes(signal)) return;

    const current = loadFeedbackPreferences();
    const cardKey = cardName.toLowerCase();
    const existing = current.cardSignals[cardKey] || { up: 0, down: 0 };

    const updated = {
        ...current.cardSignals,
        [cardKey]: {
            up: existing.up + (signal === 'up' ? 1 : 0),
            down: existing.down + (signal === 'down' ? 1 : 0)
        }
    };

    saveFeedbackPreferences({ cardSignals: updated });
}

/**
 * Get an adjustment derived from accumulated card feedback.
 * Returns both the net adjustment and total votes for transparency.
 *
 * @param {string} cardName - Name of the card
 * @returns {{adjustment: number, totalVotes: number}} Net adjustment and vote count
 */
export function getCardFeedbackAdjustment(cardName) {
    const current = loadFeedbackPreferences();
    const cardKey = (cardName || '').toLowerCase();
    const { up = 0, down = 0 } = current.cardSignals?.[cardKey] || {};
    const totalVotes = up + down;
    if (totalVotes === 0) return { adjustment: 0, totalVotes: 0 };

    // Scale adjustment gently to avoid overpowering heuristics
    const net = up - down;
    const adjustment = Math.max(-6, Math.min(6, net));
    return { adjustment, totalVotes };
}
