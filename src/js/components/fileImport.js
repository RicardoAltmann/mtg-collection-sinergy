/**
 * File import component
 * Handles drag & drop and file upload for card lists (CSV, TXT)
 * @module components/fileImport
 */

import { logger } from '../utils/logger.js';

/**
 * Prevent default browser behavior for drag events
 *
 * @param {Event} e - Drag event
 */
export function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

/**
 * Highlight drop zone when dragging over
 *
 * @param {Event} e - Drag event
 */
export function highlight(e) {
    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
        dropZone.classList.add('dragover');
    }
}

/**
 * Remove highlight from drop zone
 *
 * @param {Event} e - Drag event
 */
export function unhighlight(e) {
    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
        dropZone.classList.remove('dragover');
    }
}

/**
 * Handle file drop event
 *
 * @param {DragEvent} e - Drop event
 */
export function handleDrop(e) {
    logger.info('Files dropped');
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

/**
 * Handle file selection from file input
 *
 * @param {Event} event - Change event from file input
 */
export function handleFileSelect(event) {
    logger.info('Files selected');
    const files = event.target.files;
    handleFiles(files);
}

/**
 * Process uploaded files
 *
 * @param {FileList} files - List of uploaded files
 */
export function handleFiles(files) {
    if (files.length === 0) {
        logger.warn('No files provided');
        return;
    }

    const file = files[0];
    const fileName = file.name.toLowerCase();

    logger.info('Processing file:', fileName);

    if (!fileName.endsWith('.csv') && !fileName.endsWith('.txt')) {
        alert('Por favor selecciona un archivo .csv o .txt');
        logger.warn('Invalid file type:', fileName);
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const contents = e.target.result;
        const cardNames = parseFileContents(contents, fileName);

        if (cardNames.length > 0) {
            logger.info('Parsed card names:', cardNames.length);

            document.getElementById('newCards').value = cardNames.join('\n');

            // Scroll to manual import section
            document.querySelector('#addTab .input-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            // Show success message
            const resultsDiv = document.getElementById('addResults');
            resultsDiv.innerHTML = `
                <div class="success-message" style="margin-bottom: 20px;">
                    <strong>✓ Archivo cargado exitosamente</strong><br>
                    ${cardNames.length} carta${cardNames.length !== 1 ? 's' : ''} detectada${cardNames.length !== 1 ? 's' : ''} en el archivo.<br>
                    Revisa la lista abajo y haz click en "Agregar a Colección" para importarlas.
                </div>
            `;
        } else {
            logger.warn('No card names extracted from file');
            alert('No se pudieron extraer nombres de cartas del archivo.');
        }
    };
    reader.readAsText(file);
}

/**
 * Parse file contents and extract card names
 *
 * @param {string} contents - File contents
 * @param {string} fileName - Name of the file (used to determine format)
 * @returns {string[]} Array of card names
 */
export function parseFileContents(contents, fileName) {
    const lines = contents.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

    logger.debug('Parsing file with', lines.length, 'lines');

    if (fileName.endsWith('.csv')) {
        return parseCSV(lines);
    } else {
        // Plain text file - one card per line
        // Remove common prefixes like "1x ", "4x ", etc.
        return lines.map(line => {
            // Remove quantity prefix (e.g., "4x ", "1 ")
            return line.replace(/^\d+x?\s+/, '').trim();
        }).filter(name => name.length > 0);
    }
}

/**
 * Parse CSV file contents
 * Automatically detects delimiter (comma or tab) and card name column
 *
 * @param {string[]} lines - Array of CSV lines
 * @returns {string[]} Array of card names
 */
export function parseCSV(lines) {
    if (lines.length === 0) {
        logger.warn('Empty CSV file');
        return [];
    }

    // Try to detect delimiter
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    logger.debug('CSV delimiter detected:', delimiter === '\t' ? 'tab' : 'comma');

    // Parse header row
    const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase());

    // Find name column index
    let nameColumnIndex = headers.indexOf('name');
    if (nameColumnIndex === -1) nameColumnIndex = headers.indexOf('card name');
    if (nameColumnIndex === -1) nameColumnIndex = headers.indexOf('cardname');
    if (nameColumnIndex === -1) nameColumnIndex = headers.indexOf('card');

    const cardNames = [];

    // If no header found, assume first column is card name
    if (nameColumnIndex === -1) {
        nameColumnIndex = 0;
        logger.debug('No header found, using first column');

        // Include first line as data
        for (let i = 0; i < lines.length; i++) {
            const columns = lines[i].split(delimiter);
            if (columns.length > nameColumnIndex) {
                let cardName = columns[nameColumnIndex].trim();
                // Remove quotes if present
                cardName = cardName.replace(/^["']|["']$/g, '');
                // Remove quantity prefix
                cardName = cardName.replace(/^\d+x?\s+/, '');
                if (cardName.length > 0) {
                    cardNames.push(cardName);
                }
            }
        }
    } else {
        logger.debug('Found name column at index:', nameColumnIndex);

        // Skip header row, start from line 1
        for (let i = 1; i < lines.length; i++) {
            const columns = lines[i].split(delimiter);
            if (columns.length > nameColumnIndex) {
                let cardName = columns[nameColumnIndex].trim();
                // Remove quotes if present
                cardName = cardName.replace(/^["']|["']$/g, '');
                // Remove quantity prefix
                cardName = cardName.replace(/^\d+x?\s+/, '');
                if (cardName.length > 0) {
                    cardNames.push(cardName);
                }
            }
        }
    }

    logger.info('CSV parsed:', cardNames.length, 'cards');
    return cardNames;
}

/**
 * Download a CSV template file
 */
export function downloadTemplate() {
    logger.info('Downloading template');

    // Create CSV content with header and example cards
    const csvContent = `name
Sol Ring
Lightning Bolt
Counterspell
Command Tower
Arcane Signet`;

    // Create a Blob with the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Create a temporary download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_cartas.csv');
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);
}

/**
 * Initialize file import drag & drop listeners
 */
export function initFileImport() {
    const dropZone = document.getElementById('dropZone');

    if (!dropZone) {
        logger.warn('Drop zone element not found');
        return;
    }

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);

    logger.info('File import initialized');
}
