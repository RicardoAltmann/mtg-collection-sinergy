/**
 * Add Cards UI component
 * Handles the UI for adding cards from the manual textarea
 * @module components/addCards
 */

import { logger } from '../utils/logger.js';
import { addToCollection, loadCollection } from '../api/collection.js';
import { updateCollectionCount } from './collection.js';

/**
 * Add cards from the manual textarea to the collection
 *
 * @async
 * @returns {Promise<void>}
 */
export async function addCards() {
    const textarea = document.getElementById('newCards');
    const resultsDiv = document.getElementById('addResults');
    const addBtn = document.getElementById('addBtn');

    if (!textarea || !resultsDiv) {
        logger.error('Add cards UI elements not found');
        return;
    }

    const text = textarea.value.trim();
    if (!text) {
        resultsDiv.innerHTML = '<div class="error">Por favor ingresa al menos un nombre de carta</div>';
        return;
    }

    // Parse card names (one per line)
    const cardNames = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    if (cardNames.length === 0) {
        resultsDiv.innerHTML = '<div class="error">No se encontraron nombres de cartas válidos</div>';
        return;
    }

    logger.info('Adding cards:', cardNames.length);

    // Disable button and show loading state
    if (addBtn) addBtn.disabled = true;
    resultsDiv.innerHTML = `
        <div class="info-message">
            <div class="loading-spinner"></div>
            Agregando ${cardNames.length} carta${cardNames.length > 1 ? 's' : ''}...
        </div>
    `;

    try {
        const result = await addToCollection(cardNames);

        // Display results
        let html = '';

        if (result.added.length > 0) {
            html += `
                <div class="success-message">
                    <strong>✓ ${result.added.length} carta${result.added.length > 1 ? 's agregadas' : ' agregada'}</strong>
                </div>
            `;
        }

        if (result.skipped.length > 0) {
            html += `
                <div class="info-message" style="margin-top: 10px;">
                    <strong>⊘ ${result.skipped.length} duplicado${result.skipped.length > 1 ? 's omitidos' : ' omitido'}</strong>
                    ${result.skipped.length <= 10 ? `<br><small>${result.skipped.join(', ')}</small>` : ''}
                </div>
            `;
        }

        if (result.errors.length > 0) {
            html += `
                <div class="error" style="margin-top: 10px;">
                    <strong>✗ ${result.errors.length} error${result.errors.length > 1 ? 'es' : ''}</strong><br>
                    <small>${result.errors.map(e => `${e.card}: ${e.error}`).join('<br>')}</small>
                </div>
            `;
        }

        html += `
            <div class="info-message" style="margin-top: 10px;">
                <strong>Total en colección: ${result.totalInCollection} cartas</strong>
            </div>
        `;

        resultsDiv.innerHTML = html;

        // Clear textarea on success if all cards were added or skipped
        if (result.errors.length === 0) {
            textarea.value = '';
        }

        // Reload collection to refresh UI
        await loadCollection();

        // Update collection count
        updateCollectionCount();

    } catch (error) {
        logger.error('Error adding cards:', error);
        resultsDiv.innerHTML = `<div class="error">Error al agregar cartas: ${error.message}</div>`;
    } finally {
        if (addBtn) addBtn.disabled = false;
    }
}
