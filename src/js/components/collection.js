/**
 * Collection UI component
 * Handles displaying and filtering the card collection
 * @module components/collection
 */

import { logger } from '../utils/logger.js';
import { getCollectionData, removeFromCollection as apiRemoveFromCollection } from '../api/collection.js';

// UI state
let collectionViewMode = 'list';
let lastRenderedCards = [];

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
    lastRenderedCards = cards;

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

    const listModeClass = collectionViewMode === 'grid' ? 'collection-list grid' : 'collection-list stack';
    const items = cards.map(card => renderCollectionCard(card)).join('');

    listDiv.innerHTML = `<div class="${listModeClass}">${items}</div>`;
}

/**
 * Update the collection layout mode and re-render using the last filtered list
 * @param {'list'|'grid'} mode - Target view mode
 */
export function setCollectionViewMode(mode) {
    if (!['list', 'grid'].includes(mode)) return;
    collectionViewMode = mode;

    // Update toggle buttons if present
    const listBtn = document.getElementById('collectionListViewBtn');
    const gridBtn = document.getElementById('collectionGridViewBtn');
    if (listBtn && gridBtn) {
        listBtn.classList.toggle('active', mode === 'list');
        gridBtn.classList.toggle('active', mode === 'grid');
    }

    if (lastRenderedCards.length > 0) {
        displayCollection(lastRenderedCards);
    }
}

/**
 * Build a collection card with badges and a compact action area
 * @param {Object} card - Card data
 * @returns {string} HTML markup for the card
 */
function renderCollectionCard(card) {
    // Validate card data before displaying
    if (!card.name) {
        logger.warn('Card with incomplete data:', card);
        return '';
    }

    const cardName = card.name || 'Nombre desconocido';
    const cardType = card.type_line || 'Tipo desconocido';
    const mainType = extractMainType(cardType);

    const roleChips = [
        mainType ? `<span class="collection-chip">${mainType}</span>` : '',
        card.color_identity ? `<span class="collection-chip subtle">${card.color_identity.join('') || 'Incoloro'}</span>` : ''
    ].filter(Boolean).join('');

    const layoutClass = collectionViewMode === 'grid' ? 'collection-card tile' : 'collection-card row';

    return `
        <article class="${layoutClass}">
            <div class="collection-card__header">
                <div class="collection-card__title-group">
                    <div class="collection-card__name">${cardName}</div>
                    <div class="collection-card__chips">${roleChips}</div>
                </div>
                <button class="delete-btn ghost" onclick="window.removeFromCollectionUI('${cardName.replace(/'/g, "\\'")}')" aria-label="Eliminar ${cardName}">
                    ✕
                </button>
            </div>
            <div class="collection-card__type">${cardType}</div>
            <div class="collection-card__meta">
                <span class="meta-chip subtle">En colección</span>
                <span class="meta-chip subtle">Lista ${collectionViewMode === 'grid' ? 'visual' : 'compacta'}</span>
            </div>
        </article>
    `;
}

function extractMainType(typeLine) {
    const type = typeLine.toLowerCase();
    if (type.includes('creature')) return 'Criatura';
    if (type.includes('instant')) return 'Instantáneo';
    if (type.includes('sorcery')) return 'Conjuro';
    if (type.includes('artifact')) return 'Artefacto';
    if (type.includes('enchantment')) return 'Encantamiento';
    if (type.includes('planeswalker')) return 'Planeswalker';
    if (type.includes('land')) return 'Tierra';
    return '';
}

/**
 * Filter the collection based on search term and sort order
 */
export function filterCollection() {
    const searchInput = document.getElementById('searchCollection');
    const sortSelect = document.getElementById('sortCollection');

    // If elements don't exist, skip filtering (not on collection tab)
    if (!searchInput || !sortSelect) {
        logger.debug('Filter elements not found, skipping filter');
        return;
    }

    const searchTerm = searchInput.value.toLowerCase();
    const sortBy = sortSelect.value || 'name';

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
