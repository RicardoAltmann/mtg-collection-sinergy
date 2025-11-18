/**
 * Autocomplete component for card search
 * Provides real-time card name suggestions using Scryfall API
 * @module components/autocomplete
 */

import { logger } from '../utils/logger.js';
import { fetchAutocompleteSuggestions, fetchCommanderAutocompleteSuggestions } from '../api/scryfall.js';

// Autocomplete state
let autocompleteTimeout;
let selectedSuggestionIndex = -1;
let currentSuggestions = [];

// Commander autocomplete state
let commanderAutocompleteTimeout;
let selectedCommanderIndex = -1;
let commanderSuggestions = [];

/**
 * Handle input event on autocomplete field
 *
 * @param {Event} e - Input event
 */
export function handleAutocompleteInput(e) {
    const query = e.target.value.trim();

    // Clear previous timeout
    clearTimeout(autocompleteTimeout);

    if (query.length < 2) {
        hideAutocompleteDropdown();
        return;
    }

    // Show loading state
    const autocompleteInput = document.getElementById('autocompleteInput');
    autocompleteInput.classList.add('loading');

    // Debounce API calls - wait 300ms after user stops typing
    autocompleteTimeout = setTimeout(() => {
        fetchSuggestions(query);
    }, 300);
}

/**
 * Fetch and display autocomplete suggestions
 *
 * @async
 * @param {string} query - Search query
 */
async function fetchSuggestions(query) {
    const autocompleteInput = document.getElementById('autocompleteInput');

    try {
        logger.debug('Fetching autocomplete suggestions for:', query);
        const suggestions = await fetchAutocompleteSuggestions(query);

        autocompleteInput.classList.remove('loading');

        if (suggestions && suggestions.length > 0) {
            currentSuggestions = suggestions;
            displayAutocompleteSuggestions(suggestions);
        } else {
            showNoResults();
        }
    } catch (error) {
        logger.error('Autocomplete error:', error);
        autocompleteInput.classList.remove('loading');
        hideAutocompleteDropdown();
    }
}

/**
 * Display autocomplete suggestions in the dropdown
 *
 * @param {string[]} suggestions - Array of card name suggestions
 */
export function displayAutocompleteSuggestions(suggestions) {
    const autocompleteDropdown = document.getElementById('autocompleteDropdown');
    selectedSuggestionIndex = -1;

    let html = '';
    suggestions.forEach((cardName, index) => {
        html += `
            <div class="autocomplete-item" data-index="${index}" onclick="window.selectSuggestionFromAutocomplete('${cardName.replace(/'/g, "\\'")}')">
                <div class="autocomplete-item-name">${cardName}</div>
            </div>
        `;
    });

    autocompleteDropdown.innerHTML = html;
    autocompleteDropdown.classList.remove('hidden');
    logger.debug('Displayed autocomplete suggestions:', suggestions.length);
}

/**
 * Handle keyboard navigation in autocomplete dropdown
 *
 * @param {KeyboardEvent} e - Keyboard event
 */
export function handleAutocompleteKeydown(e) {
    const autocompleteDropdown = document.getElementById('autocompleteDropdown');
    const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, items.length - 1);
        updateSelectedSuggestion(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
        updateSelectedSuggestion(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < currentSuggestions.length) {
            selectSuggestion(currentSuggestions[selectedSuggestionIndex]);
        } else {
            addCardFromAutocomplete();
        }
    } else if (e.key === 'Escape') {
        hideAutocompleteDropdown();
    }
}

/**
 * Select a suggestion from the dropdown
 *
 * @param {string} cardName - Name of the selected card
 */
export function selectSuggestion(cardName) {
    const autocompleteInput = document.getElementById('autocompleteInput');
    autocompleteInput.value = cardName;
    hideAutocompleteDropdown();
    logger.debug('Selected suggestion:', cardName);
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
 * Show "no results" message in autocomplete dropdown
 */
export function showNoResults() {
    const autocompleteDropdown = document.getElementById('autocompleteDropdown');
    autocompleteDropdown.innerHTML = '<div class="autocomplete-no-results">No se encontraron cartas</div>';
    autocompleteDropdown.classList.remove('hidden');
}

/**
 * Hide the autocomplete dropdown
 */
export function hideAutocompleteDropdown() {
    const autocompleteDropdown = document.getElementById('autocompleteDropdown');
    autocompleteDropdown.classList.add('hidden');
    autocompleteDropdown.innerHTML = '';
    selectedSuggestionIndex = -1;
    currentSuggestions = [];
}

/**
 * Update the selected suggestion visual state
 *
 * @param {NodeList} items - List of autocomplete item elements
 */
export function updateSelectedSuggestion(items) {
    items.forEach((item, index) => {
        if (index === selectedSuggestionIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

/** Commander Autocomplete **/

/**
 * Handle input event on commander field
 *
 * @param {Event} e - Input event
 */
export function handleCommanderAutocompleteInput(e) {
    const query = e.target.value.trim();

    clearTimeout(commanderAutocompleteTimeout);

    if (query.length < 2) {
        hideCommanderAutocompleteDropdown();
        return;
    }

    const commanderInput = document.getElementById('commander');
    commanderInput.classList.add('loading');

    commanderAutocompleteTimeout = setTimeout(() => {
        fetchCommanderSuggestions(query);
    }, 300);
}

/**
 * Fetch and display commander autocomplete suggestions
 *
 * @param {string} query - Search query
 */
async function fetchCommanderSuggestions(query) {
    const commanderInput = document.getElementById('commander');

    try {
        logger.debug('Fetching commander autocomplete suggestions for:', query);
        const suggestions = await fetchCommanderAutocompleteSuggestions(query);

        commanderInput.classList.remove('loading');

        if (suggestions && suggestions.length > 0) {
            commanderSuggestions = suggestions;
            displayCommanderSuggestions(suggestions);
        } else {
            showCommanderNoResults();
        }
    } catch (error) {
        logger.error('Commander autocomplete error:', error);
        commanderInput.classList.remove('loading');
        hideCommanderAutocompleteDropdown();
    }
}

/**
 * Display commander autocomplete suggestions
 *
 * @param {string[]} suggestions - Array of commander name suggestions
 */
export function displayCommanderSuggestions(suggestions) {
    const dropdown = document.getElementById('commanderAutocompleteDropdown');
    selectedCommanderIndex = -1;

    let html = '';
    suggestions.forEach((commanderName, index) => {
        html += `
            <div class="autocomplete-item" data-index="${index}" onclick="window.selectCommanderSuggestionFromAutocomplete('${commanderName.replace(/'/g, "\\'")}')">
                <div class="autocomplete-item-name">${commanderName}</div>
            </div>
        `;
    });

    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
    logger.debug('Displayed commander autocomplete suggestions:', suggestions.length);
}

/**
 * Handle keyboard navigation for commander autocomplete
 *
 * @param {KeyboardEvent} e - Keyboard event
 */
export function handleCommanderAutocompleteKeydown(e) {
    const dropdown = document.getElementById('commanderAutocompleteDropdown');
    const items = dropdown.querySelectorAll('.autocomplete-item');

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedCommanderIndex = Math.min(selectedCommanderIndex + 1, items.length - 1);
        updateSelectedCommander(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedCommanderIndex = Math.max(selectedCommanderIndex - 1, -1);
        updateSelectedCommander(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedCommanderIndex >= 0 && selectedCommanderIndex < commanderSuggestions.length) {
            selectCommanderSuggestion(commanderSuggestions[selectedCommanderIndex]);
        }
    } else if (e.key === 'Escape') {
        hideCommanderAutocompleteDropdown();
    }
}

/**
 * Select a commander suggestion
 *
 * @param {string} commanderName - Selected commander name
 */
export function selectCommanderSuggestion(commanderName) {
    const commanderInput = document.getElementById('commander');
    commanderInput.value = commanderName;
    hideCommanderAutocompleteDropdown();
    logger.debug('Selected commander suggestion:', commanderName);
}

/**
 * Show no results message for commander search
 */
export function showCommanderNoResults() {
    const dropdown = document.getElementById('commanderAutocompleteDropdown');
    dropdown.innerHTML = '<div class="autocomplete-no-results">No se encontraron commanders</div>';
    dropdown.classList.remove('hidden');
}

/**
 * Hide commander autocomplete dropdown
 */
export function hideCommanderAutocompleteDropdown() {
    const dropdown = document.getElementById('commanderAutocompleteDropdown');
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
    selectedCommanderIndex = -1;
    commanderSuggestions = [];
}

/**
 * Update selected commander suggestion visual state
 *
 * @param {NodeList} items - List of autocomplete item elements
 */
export function updateSelectedCommander(items) {
    items.forEach((item, index) => {
        if (index === selectedCommanderIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

/**
 * Initialize commander autocomplete listeners
 */
export function initCommanderAutocomplete() {
    const commanderInput = document.getElementById('commander');
    const commanderDropdown = document.getElementById('commanderAutocompleteDropdown');

    if (!commanderInput || !commanderDropdown) {
        logger.warn('Commander autocomplete elements not found');
        return;
    }

    commanderInput.addEventListener('input', handleCommanderAutocompleteInput);
    commanderInput.addEventListener('keydown', handleCommanderAutocompleteKeydown);

    logger.info('Commander autocomplete initialized');
}

/**
 * Initialize autocomplete event listeners
 */
export function initAutocomplete() {
    const autocompleteInput = document.getElementById('autocompleteInput');
    const autocompleteDropdown = document.getElementById('autocompleteDropdown');

    if (!autocompleteInput || !autocompleteDropdown) {
        logger.warn('Autocomplete elements not found');
    } else {
        autocompleteInput.addEventListener('input', handleAutocompleteInput);
        autocompleteInput.addEventListener('keydown', handleAutocompleteKeydown);
    }

    initCommanderAutocomplete();

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.autocomplete-container')) {
            hideAutocompleteDropdown();
            hideCommanderAutocompleteDropdown();
        }
    });

    logger.info('Autocomplete initialized');
}
