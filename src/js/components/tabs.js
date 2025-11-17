/**
 * Tab management component
 * Handles switching between different sections of the application
 * @module components/tabs
 */

import { logger } from '../utils/logger.js';
import { loadCollection } from '../api/collection.js';

/**
 * Switch between application tabs
 *
 * @param {string} tabName - Name of the tab to switch to (e.g., 'analyze', 'collection', 'add')
 * @param {Event} [event] - Optional click event
 */
export function switchTab(tabName, event) {
    logger.debug('Switching to tab:', tabName);

    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.add('active');
    if (event && event.target) {
        event.target.classList.add('active');
    }

    // Load collection when switching to collection tab
    if (tabName === 'collection') {
        const collectionListDiv = document.getElementById('collectionList');
        if (collectionListDiv) {
            collectionListDiv.innerHTML = '<div class="loading">⏳ Cargando colección...</div>';
        }

        loadCollection({
            onProgress: (loaded, total) => {
                if (collectionListDiv && total > 200) {
                    collectionListDiv.innerHTML = `<div class="loading">⏳ Cargando colección... ${loaded}/${total} cartas</div>`;
                }
            }
        })
            .then(async () => {
                const { updateCollectionCount, filterCollection } = await import('./collection.js');
                updateCollectionCount();
                filterCollection();
            })
            .catch(error => {
                logger.error('Failed to load collection on tab switch:', error);
            });
    }
}

/**
 * Toggle collapsible sections
 *
 * @param {string} id - ID of the collapsible section
 */
export function toggleCollapse(id) {
    const content = document.getElementById(id + '-content');
    const toggle = document.getElementById(id + '-toggle');

    if (!content || !toggle) {
        logger.warn('Collapsible element not found:', id);
        return;
    }

    if (content.classList.contains('open')) {
        content.classList.remove('open');
        toggle.classList.remove('open');
        logger.debug('Collapsed section:', id);
    } else {
        content.classList.add('open');
        toggle.classList.add('open');
        logger.debug('Expanded section:', id);
    }
}
