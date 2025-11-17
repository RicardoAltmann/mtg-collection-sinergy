/**
 * Helper utility functions for MTG card processing
 * @module utils/helpers
 */

export const BASE_PERMANENT_TYPES = ['artifact', 'battle', 'creature', 'enchantment', 'land', 'planeswalker'];

/**
 * Extract creature types from a card's type line
 * Searches for common creature types in Magic: The Gathering
 *
 * @param {string} typeString - The type line of a card (e.g., "Legendary Creature — Human Wizard")
 * @returns {string[]} Array of creature types found in the type line
 *
 * @example
 * extractCreatureTypes("Legendary Creature — Human Wizard")
 * // Returns: ["human", "wizard"]
 */
export function extractCreatureTypes(typeString) {
    const commonTypes = [
        'human', 'elf', 'goblin', 'zombie', 'angel', 'demon', 'dragon',
        'wizard', 'warrior', 'knight', 'soldier', 'vampire', 'werewolf',
        'merfolk', 'elemental', 'beast', 'spirit', 'artifact', 'enchantment'
    ];
    return commonTypes.filter(type => typeString.includes(type));
}

/**
 * Determine whether a card type line represents a permanent.
 *
 * @param {string} typeLine - Card type line to inspect
 * @param {string[]} [permanentTypes=BASE_PERMANENT_TYPES] - Allowed permanent types
 * @returns {boolean} True if the type line contains a permanent type
 */
export function isPermanentType(typeLine, permanentTypes = BASE_PERMANENT_TYPES) {
    const normalized = (typeLine || '').toLowerCase();
    return permanentTypes.some(type => normalized.includes(type));
}

/**
 * Count mana pips of specific colors in a card's mana cost
 * Used for devotion, chroma, and other pip-counting mechanics
 *
 * @param {string} manaCost - The mana cost string (e.g., "{2}{W}{W}{U}")
 * @param {string[]} targetColors - Array of color codes to count (e.g., ["W", "U"])
 * @returns {number} Total number of matching color pips
 *
 * @example
 * countColorPips("{2}{W}{W}{U}", ["W", "U"])
 * // Returns: 3 (2 white pips + 1 blue pip)
 *
 * @example
 * countColorPips("{3}{R}{R}{G}", ["R"])
 * // Returns: 2 (2 red pips)
 */
export function countColorPips(manaCost, targetColors) {
    if (!manaCost) return 0;
    let count = 0;

    // Regex to find individual mana symbols
    const manaSymbols = manaCost.match(/\{[^}]+\}/g) || [];

    manaSymbols.forEach(symbol => {
        targetColors.forEach(color => {
            if (symbol.includes(color)) {
                count++;
            }
        });
    });

    return count;
}
