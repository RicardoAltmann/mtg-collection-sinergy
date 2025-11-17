/**
 * Collection UI component
 * Handles displaying and filtering the card collection
 * @module components/collection
 */

import { logger } from '../utils/logger.js';
import { getCollectionData, removeFromCollection as apiRemoveFromCollection } from '../api/collection.js';

/**
 * Display the collection in the UI
 *
 * @param {Object[]} cards - Array of card objects to display
 */
export function displayCollection(cards) {
    const listDiv = document.getElementById('collectionList');
    if (!listDiv) {
        logger.warn('Collection list element not found');
        return;
    }

    logger.info('Displaying collection:', cards.length, 'cards');

    if (cards.length === 0) {
        listDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎴</div>
                <h3 style="color: #f39c12; margin-bottom: 15px;">Tu colección está vacía</h3>
                <p style="margin-bottom: 20px; font-size: 1.1em;">¡Comienza agregando tus cartas de Magic!</p>
                <button onclick="switchTab('add', event)" style="margin-top: 10px;">
                    ➕ Agregar Cartas
                </button>
                <div style="margin-top: 30px; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 8px; text-align: left;">
                    <p style="font-weight: 600; margin-bottom: 10px; color: #f39c12;">💡 Consejos para empezar:</p>
                    <ul style="list-style: none; padding: 0; color: #bdc3c7;">
                        <li style="margin: 8px 0;">✓ Pega los nombres de cartas (una por línea)</li>
                        <li style="margin: 8px 0;">✓ Los nombres pueden estar en inglés</li>
                        <li style="margin: 8px 0;">✓ El sistema buscará automáticamente en Scryfall</li>
                        <li style="margin: 8px 0;">✓ Las cartas duplicadas se detectan automáticamente</li>
                    </ul>
                </div>
            </div>
        `;
        return;
    }

    let html = '<div class="synergy-list">';
    cards.forEach(card => {
        // Validate card data before displaying
        const cardName = card.name || 'Nombre desconocido';
        const cardType = card.type_line || 'Tipo desconocido';

        // Skip cards with invalid data
        if (!card.name) {
            logger.warn('Card with incomplete data:', card);
            return;
        }

        html += `
            <div class="collection-item">
                <div class="collection-item-info">
                    <div class="collection-item-name">${cardName}</div>
                    <div class="collection-item-type">${cardType}</div>
                </div>
                <button class="delete-btn" onclick="window.removeFromCollectionUI('${cardName.replace(/'/g, "\\'")}')">
                    Eliminar
                </button>
            </div>
        `;
    });
    html += '</div>';

    listDiv.innerHTML = html;
}

/**
 * Filter the collection based on search term and sort order
 */
export function filterCollection() {
    const searchTerm = document.getElementById('searchCollection').value.toLowerCase();
    const sortBy = document.getElementById('sortCollection')?.value || 'name';

    logger.debug('Filtering collection:', { searchTerm, sortBy });

    const allCollectionData = getCollectionData();

    let filtered = allCollectionData.filter(card => {
        // Skip cards without name (invalid data)
        if (!card.name) return false;

        const cardName = card.name.toLowerCase();
        const cardType = (card.type_line || '').toLowerCase();

        return cardName.includes(searchTerm) || cardType.includes(searchTerm);
    });

    // Sort
    filtered.sort((a, b) => {
        switch(sortBy) {
            case 'name':
                return (a.name || '').localeCompare(b.name || '');
            case 'type':
                return (a.type_line || '').localeCompare(b.type_line || '');
            case 'date':
                return 0; // Keep original order (most recent first in Supabase)
            default:
                return 0;
        }
    });

    logger.info('Filtered collection:', filtered.length, 'cards');
    displayCollection(filtered);
}

/**
 * Update the collection count display
 */
export function updateCollectionCount() {
    const countElement = document.getElementById('collectionCount');
    if (countElement) {
        const allCollectionData = getCollectionData();
        countElement.textContent = allCollectionData.length;
        logger.debug('Collection count updated:', allCollectionData.length);
    }
}

/**
 * Remove a card from the collection (UI wrapper)
 *
 * @async
 * @param {string} cardName - Name of the card to remove
 */
export async function removeFromCollectionUI(cardName) {
    if (!confirm(`¿Seguro que quieres eliminar "${cardName}" de tu colección?`)) {
        return;
    }

    logger.info('Removing card from collection UI:', cardName);

    try {
        await apiRemoveFromCollection(cardName);
        // Reload collection to update UI
        const { loadCollection } = await import('../api/collection.js');
        await loadCollection();
        updateCollectionCount();
        filterCollection();
    } catch (error) {
        logger.error('Error removing card:', error);
        alert('Error: ' + error.message);
    }
}
