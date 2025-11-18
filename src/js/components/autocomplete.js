/**
 * Autocomplete component for card search
 * Provides real-time card name suggestions using Scryfall API
 * @module components/autocomplete
 */

import { logger } from '../utils/logger.js';
import { fetchAutocompleteSuggestions } from '../api/scryfall.js';

// Store autocomplete instances
const autocompleteInstances = new Map();

/**
 * Create an autocomplete instance for a specific input
 *
 * @param {string} inputId - ID of the input element
 * @param {string} dropdownId - ID of the dropdown element
 * @param {Function} onSelect - Optional callback when a suggestion is selected
 * @param {boolean} commandersOnly - If true, only fetch legal commanders
 * @returns {Object} Autocomplete instance methods
 */
export function createAutocomplete(inputId, dropdownId, onSelect = null, commandersOnly = false) {
    const state = {
        timeout: null,
        selectedIndex: -1,
        suggestions: []
    };

    const handleInput = (e) => {
        const query = e.target.value.trim();
        const input = document.getElementById(inputId);

        // Clear previous timeout
        clearTimeout(state.timeout);

        if (query.length < 2) {
            hideDropdown();
            return;
        }

        // Show loading state
        input.classList.add('loading');

        // Debounce API calls - wait 300ms after user stops typing
        state.timeout = setTimeout(() => {
            fetchSuggestions(query);
        }, 300);
    };

    const fetchSuggestions = async (query) => {
        const input = document.getElementById(inputId);

        try {
            logger.debug(`Fetching autocomplete suggestions for ${inputId}:`, query);
            const suggestions = await fetchAutocompleteSuggestions(query, commandersOnly);

            input.classList.remove('loading');

            if (suggestions && suggestions.length > 0) {
                state.suggestions = suggestions;
                displaySuggestions(suggestions);
            } else {
                showNoResults();
            }
        } catch (error) {
            logger.error('Autocomplete error:', error);
            input.classList.remove('loading');
            hideDropdown();
        }
    };

    const displaySuggestions = (suggestions) => {
        const dropdown = document.getElementById(dropdownId);
        state.selectedIndex = -1;

        let html = '';
        suggestions.forEach((cardName, index) => {
            const escapedName = cardName.replace(/'/g, "\\'");
            const instanceKey = `${inputId}_${dropdownId}`;
            html += `
                <div class="autocomplete-item" data-index="${index}" onclick="window.selectAutocompleteItem('${instanceKey}', '${escapedName}')">
                    <div class="autocomplete-item-name">${cardName}</div>
                </div>
            `;
        });

        dropdown.innerHTML = html;
        dropdown.classList.remove('hidden');
        logger.debug(`Displayed autocomplete suggestions for ${inputId}:`, suggestions.length);
    };

    const handleKeydown = (e) => {
        const dropdown = document.getElementById(dropdownId);
        const items = dropdown.querySelectorAll('.autocomplete-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            state.selectedIndex = Math.min(state.selectedIndex + 1, items.length - 1);
            updateSelectedItem(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            state.selectedIndex = Math.max(state.selectedIndex - 1, -1);
            updateSelectedItem(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (state.selectedIndex >= 0 && state.selectedIndex < state.suggestions.length) {
                selectItem(state.suggestions[state.selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            hideDropdown();
        }
    };

    const selectItem = (cardName) => {
        const input = document.getElementById(inputId);
        input.value = cardName;
        hideDropdown();
        logger.debug(`Selected suggestion for ${inputId}:`, cardName);

        if (onSelect) {
            onSelect(cardName);
        }
    };

    const showNoResults = () => {
        const dropdown = document.getElementById(dropdownId);
        dropdown.innerHTML = '<div class="autocomplete-no-results">No se encontraron cartas</div>';
        dropdown.classList.remove('hidden');
    };

    const hideDropdown = () => {
        const dropdown = document.getElementById(dropdownId);
        dropdown.classList.add('hidden');
        dropdown.innerHTML = '';
        state.selectedIndex = -1;
        state.suggestions = [];
    };

    const updateSelectedItem = (items) => {
        items.forEach((item, index) => {
            if (index === state.selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    };

    return {
        handleInput,
        handleKeydown,
        selectItem,
        hideDropdown,
        state
    };
}

/**
 * Legacy function for backward compatibility - handles card add autocomplete input
 *
 * @param {Event} e - Input event
 */
export function handleAutocompleteInput(e) {
    const instance = autocompleteInstances.get('autocompleteInput_autocompleteDropdown');
    if (instance) {
        instance.handleInput(e);
    }
}

/**
 * Legacy function for backward compatibility - displays suggestions
 *
 * @param {string[]} suggestions - Array of card name suggestions
 */
export function displayAutocompleteSuggestions(suggestions) {
    // This is now handled by the instance
    logger.debug('displayAutocompleteSuggestions called (legacy)');
}

/**
 * Legacy function for backward compatibility - handles keydown
 *
 * @param {KeyboardEvent} e - Keyboard event
 */
export function handleAutocompleteKeydown(e) {
    const instance = autocompleteInstances.get('autocompleteInput_autocompleteDropdown');
    if (instance) {
        instance.handleKeydown(e);
    }
}

/**
 * Legacy function for backward compatibility - selects a suggestion
 *
 * @param {string} cardName - Name of the selected card
 */
export function selectSuggestion(cardName) {
    const instance = autocompleteInstances.get('autocompleteInput_autocompleteDropdown');
    if (instance) {
        instance.selectItem(cardName);
    }
}

/**
 * Add the autocomplete input value to the manual textarea
 *
 * @async
 */
export async function addCardFromAutocomplete() {
    const autocompleteInput = document.getElementById('autocompleteInput');
    const cardName = autocompleteInput.value.trim();

    if (!cardName) {
        return;
    }

    logger.info('Adding card from autocomplete:', cardName);

    // Add to manual textarea
    const textarea = document.getElementById('newCards');
    const currentValue = textarea.value.trim();

    if (currentValue) {
        textarea.value = currentValue + '\n' + cardName;
    } else {
        textarea.value = cardName;
    }

    // Clear autocomplete input
    autocompleteInput.value = '';
    hideAutocompleteDropdown();

    // Show success feedback
    const resultsDiv = document.getElementById('addResults');
    resultsDiv.innerHTML = `
        <div class="success-message" style="margin-bottom: 20px;">
            <strong>✓ "${cardName}" agregada a la lista</strong><br>
            Haz click en "Agregar a Colección" para importarla.
        </div>
    `;

    // Auto-scroll to manual section
    textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Legacy function for backward compatibility - hides dropdown
 */
export function hideAutocompleteDropdown() {
    const instance = autocompleteInstances.get('autocompleteInput_autocompleteDropdown');
    if (instance) {
        instance.hideDropdown();
    }
}

/**
 * Global function to select an autocomplete item (called from onclick)
 *
 * @param {string} instanceKey - Key identifying the autocomplete instance
 * @param {string} cardName - Name of the selected card
 */
export function selectAutocompleteItem(instanceKey, cardName) {
    const instance = autocompleteInstances.get(instanceKey);
    if (instance) {
        instance.selectItem(cardName);
    }
}

/**
 * Initialize autocomplete event listeners
 */
export function initAutocomplete() {
    // Initialize card add autocomplete
    const autocompleteInput = document.getElementById('autocompleteInput');
    const autocompleteDropdown = document.getElementById('autocompleteDropdown');

    if (autocompleteInput && autocompleteDropdown) {
        const cardAddInstance = createAutocomplete('autocompleteInput', 'autocompleteDropdown');
        autocompleteInstances.set('autocompleteInput_autocompleteDropdown', cardAddInstance);

        autocompleteInput.addEventListener('input', cardAddInstance.handleInput);
        autocompleteInput.addEventListener('keydown', cardAddInstance.handleKeydown);

        logger.info('Card add autocomplete initialized');
    } else {
        logger.warn('Card add autocomplete elements not found');
    }

    // Initialize commander autocomplete
    const commanderInput = document.getElementById('commander');
    const commanderDropdown = document.getElementById('commanderAutocompleteDropdown');

    if (commanderInput && commanderDropdown) {
        const commanderInstance = createAutocomplete('commander', 'commanderAutocompleteDropdown', null, true);
        autocompleteInstances.set('commander_commanderAutocompleteDropdown', commanderInstance);

        commanderInput.addEventListener('input', commanderInstance.handleInput);
        commanderInput.addEventListener('keydown', commanderInstance.handleKeydown);

        logger.info('Commander autocomplete initialized');
    } else {
        logger.warn('Commander autocomplete elements not found');
    }

    // Close dropdowns when clicking outside any autocomplete container
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.autocomplete-container')) {
            autocompleteInstances.forEach(instance => {
                instance.hideDropdown();
            });
        }
    });

    // Make selectAutocompleteItem globally accessible
    window.selectAutocompleteItem = selectAutocompleteItem;

    logger.info('Autocomplete initialization complete');
}
