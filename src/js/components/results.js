/**
 * Results display component
 * Handles displaying synergy analysis results with filters
 * @module components/results
 */

import { logger } from '../utils/logger.js';

// Store all synergies for filtering
let allSynergies = [];
let activeTypeFilter = 'all';
let viewMode = 'cards';
let commanderData = null;

/**
 * Set the commander data for results display
 *
 * @param {Object} data - Commander card data
 */
export function setCommanderData(data) {
    commanderData = data;
}

/**
 * Display synergy analysis results
 *
 * @param {Object[]} synergies - Array of synergy objects
 * @param {Object[]} errors - Array of error messages
 */
export function displayResults(synergies, errors) {
    allSynergies = synergies;
    activeTypeFilter = 'all';
    const resultsDiv = document.getElementById('results');

    logger.info('Displaying results:', synergies.length, 'cards');

    // Save results for persistence (handled by synergy engine)
    if (window.saveAnalysisResults) {
        window.saveAnalysisResults(synergies);
    }

    const highSynergy = synergies.filter(s => s.score >= 20);
    const mediumSynergy = synergies.filter(s => s.score >= 5 && s.score < 20);
    const lowSynergy = synergies.filter(s => s.score < 5 && s.score >= 0);
    const outOfColor = synergies.filter(s => s.score < 0);

    // Get unique card types
    const cardTypes = getCardTypes(synergies);

    // Detect archetype from first result (all have the same)
    const detectedArchetype = synergies.length > 0 ? synergies[0].archetype : 'midrange';
    const archetypeEmojis = {
        aggro: '⚔️',
        control: '🛡️',
        combo: '🎯',
        midrange: '⚖️',
        ramp: '🌲',
        voltron: '🗡️',
        stax: '🔒'
    };
    const archetypeDescriptions = {
        aggro: 'Estrategia agresiva enfocada en atacar rápido',
        control: 'Control del tablero y acumulación de ventajas',
        combo: 'Victoria mediante combinaciones infinitas',
        midrange: 'Equilibrio entre amenazas y respuestas',
        ramp: 'Aceleración de maná para grandes amenazas',
        voltron: 'Potenciar al comandante con equipos/auras',
        stax: 'Limitar recursos y opciones de oponentes'
    };

    let html = `
        <div class="commander-info">
            <h2>${commanderData.name}</h2>
            <p class="card-type">${commanderData.type_line}</p>
            <div style="margin: 10px 0; padding: 10px; background: rgba(52, 152, 219, 0.15); border-left: 3px solid #3498db; border-radius: 4px;">
                <strong style="color: #3498db;">${archetypeEmojis[detectedArchetype]} Arquetipo detectado: ${detectedArchetype.toUpperCase()}</strong>
                <p style="margin: 5px 0 0 0; color: #95a5a6; font-size: 0.9em;">${archetypeDescriptions[detectedArchetype]}</p>
            </div>
            <p style="margin-top: 10px; color: #bdc3c7;">${commanderData.oracle_text || ''}</p>
            <div class="stats">
                <div class="stat-box tooltip">
                    <div class="stat-value">${highSynergy.length}</div>
                    <div class="stat-label">Alta Sinergia</div>
                    <span class="tooltiptext">Cartas con puntaje ≥20. Comparten mecánicas clave, keywords o sinergias fuertes con tu Commander. Prioriza estas cartas para tu mazo.</span>
                </div>
                <div class="stat-box tooltip">
                    <div class="stat-value">${mediumSynergy.length}</div>
                    <div class="stat-label">Media Sinergia</div>
                    <span class="tooltiptext">Cartas con puntaje entre 5-19. Tienen alguna sinergia o utilidad con tu Commander. Son buenas opciones de relleno para el mazo.</span>
                </div>
                <div class="stat-box tooltip">
                    <div class="stat-value">${lowSynergy.length}</div>
                    <div class="stat-label">Baja Sinergia</div>
                    <span class="tooltiptext">Cartas con puntaje 0-4. Poca o ninguna sinergia específica detectada. Pueden ser staples generales o cartas de utilidad básica.</span>
                </div>
                <div class="stat-box tooltip">
                    <div class="stat-value">${outOfColor.length}</div>
                    <div class="stat-label">Fuera de Color</div>
                    <span class="tooltiptext">Cartas fuera de la identidad de color de tu Commander. No son legales en este mazo según las reglas de Commander.</span>
                </div>
            </div>
    `;

    if (errors.length > 0) {
        html += `
            <div style="margin-top: 15px; padding: 10px; background: rgba(231, 76, 60, 0.1); border-radius: 8px;">
                <strong>⚠️ Cartas no encontradas:</strong> ${errors.join(', ')}
            </div>
        `;
    }

    html += '</div>';

    // Filters with active counter
    html += `
        <div class="filters">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <label style="margin: 0;">Filtrar por tipo de carta:</label>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div class="view-toggle" role="group" aria-label="Cambiar vista de resultados">
                        <button class="view-btn ${viewMode === 'cards' ? 'active' : ''}" onclick="window.toggleViewModeUI('cards', event)">
                            🔳 Tarjetas
                        </button>
                        <button class="view-btn ${viewMode === 'list' ? 'active' : ''}" onclick="window.toggleViewModeUI('list', event)">
                            📃 Lista
                        </button>
                    </div>
                    <div id="filterCounter" style="background: rgba(243, 156, 18, 0.2); padding: 8px 16px; border-radius: 6px; border: 2px solid #f39c12;">
                        <strong style="color: #f39c12;">${synergies.length}</strong>
                        <span style="color: #95a5a6;"> carta${synergies.length !== 1 ? 's' : ''} mostrada${synergies.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            </div>
            <div class="filter-group">
                <div class="filter-buttons">
                    <button class="filter-btn ${activeTypeFilter === 'all' ? 'active' : ''}" onclick="window.filterByTypeUI('all', event)">
                        🔮 Todas (${synergies.length})
                    </button>
                    ${cardTypes.map(type => {
                        const icons = {
                            'creature': '👹',
                            'instant': '⚡',
                            'sorcery': '🔥',
                            'artifact': '⚙️',
                            'enchantment': '✨',
                            'planeswalker': '🎭',
                            'land': '🏔️'
                        };
                        return `
                        <button class="filter-btn ${activeTypeFilter === type.key ? 'active' : ''}" onclick="window.filterByTypeUI('${type.key}', event)">
                            ${icons[type.key] || '📜'} ${type.name} (${type.count})
                        </button>
                    `}).join('')}
                </div>
            </div>
        </div>
    `;

    html += '<div id="filteredResults">';
    html += renderFilteredResults(getFilteredSynergies());
    html += '</div>';

    resultsDiv.innerHTML = html;
}

/**
 * Render filtered results
 *
 * @param {Object[]} synergies - Filtered synergy objects
 * @returns {string} HTML string
 */
export function renderFilteredResults(synergies) {
    const highSynergy = synergies.filter(s => s.score >= 20);
    const mediumSynergy = synergies.filter(s => s.score >= 5 && s.score < 20);
    const lowSynergy = synergies.filter(s => s.score < 5 && s.score >= 0);
    const outOfColor = synergies.filter(s => s.score < 0);

    let html = '';

    if (highSynergy.length > 0) {
        html += '<h2 style="color: #27ae60; margin: 20px 0;">🔥 Alta Sinergia</h2>';
        html += `<div class="synergy-list ${viewMode === 'list' ? 'list-view' : ''}">`;
        highSynergy.forEach(item => {
            html += renderCardByMode(item);
        });
        html += '</div>';
    }

    if (mediumSynergy.length > 0) {
        html += '<h2 style="color: #f39c12; margin: 20px 0;">⚡ Media Sinergia</h2>';
        html += `<div class="synergy-list ${viewMode === 'list' ? 'list-view' : ''}">`;
        mediumSynergy.forEach(item => {
            html += renderCardByMode(item);
        });
        html += '</div>';
    }

    // Collapsible for low synergy (collapsed by default)
    if (lowSynergy.length > 0) {
        html += `
            <div class="collapsible-section">
                <div class="collapsible-header" onclick="window.toggleCollapseUI('lowSynergy')">
                    <h2 style="color: #95a5a6;">📝 Baja Sinergia (${lowSynergy.length})</h2>
                    <span class="collapsible-toggle" id="lowSynergy-toggle">▼</span>
                </div>
                <div class="collapsible-content" id="lowSynergy-content">
                    <div class="synergy-list ${viewMode === 'list' ? 'list-view' : ''}" style="margin-top: 15px;">
        `;
        lowSynergy.forEach(item => {
            html += renderCardByMode(item);
        });
        html += `
                    </div>
                </div>
            </div>
        `;
    }

    // Collapsible for out of color (collapsed by default)
    if (outOfColor.length > 0) {
        html += `
            <div class="collapsible-section">
                <div class="collapsible-header" onclick="window.toggleCollapseUI('outOfColor')">
                    <h2 style="color: #e74c3c;">🚫 Fuera de Identidad de Color (${outOfColor.length})</h2>
                    <span class="collapsible-toggle" id="outOfColor-toggle">▼</span>
                </div>
                <div class="collapsible-content" id="outOfColor-content">
                    <div class="synergy-list ${viewMode === 'list' ? 'list-view' : ''}" style="margin-top: 15px;">
        `;
        outOfColor.forEach(item => {
            html += renderCardByMode(item);
        });
        html += `
                    </div>
                </div>
            </div>
        `;
    }

    if (synergies.length === 0) {
        html += `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <p>No se encontraron cartas con este filtro</p>
            </div>
        `;
    }

    return html;
}

function renderCardByMode(item) {
    return viewMode === 'list' ? createListItemHTML(item) : createCardHTML(item);
}

/**
 * Create HTML for a single card item
 *
 * @param {Object} item - Synergy item object
 * @returns {string} HTML string
 */
export function createCardHTML(item) {
    const reasonsList = item.reasons.length > 0
        ? '<ul class="synergy-reasons">' + item.reasons.map(r => `<li>${r}</li>`).join('') + '</ul>'
        : '<p style="color: #7f8c8d;">Sin sinergia específica detectada</p>';

    // Extract main card type for badge
    const typeLine = item.card.type_line.toLowerCase();
    let mainType = '';
    if (typeLine.includes('creature')) mainType = 'Criatura';
    else if (typeLine.includes('instant')) mainType = 'Instantáneo';
    else if (typeLine.includes('sorcery')) mainType = 'Conjuro';
    else if (typeLine.includes('artifact')) mainType = 'Artefacto';
    else if (typeLine.includes('enchantment')) mainType = 'Encantamiento';
    else if (typeLine.includes('planeswalker')) mainType = 'Planeswalker';
    else if (typeLine.includes('land')) mainType = 'Tierra';

    const synergyTier = item.score >= 20
        ? 'high'
        : item.score >= 5
            ? 'medium'
            : item.score >= 0
                ? 'low'
                : 'offcolor';

    const tierLabels = {
        high: 'Alta sinergia',
        medium: 'Media sinergia',
        low: 'Sinergia baja',
        offcolor: 'Fuera de color'
    };

    return `
        <div class="card-item">
            <div class="card-header">
                <div class="card-heading">
                    <div class="card-name-row">
                        <div class="card-name">${item.card.name}</div>
                        ${mainType ? `<span class="card-badge">${mainType}</span>` : ''}
                    </div>
                    <div class="card-subtitle">${item.card.type_line}</div>
                    <div class="card-meta">
                        ${item.role ? `<span class="meta-chip">Rol: ${item.role}</span>` : ''}
                        ${item.archetype ? `<span class="meta-chip subtle">Arquetipo ${item.archetype}</span>` : ''}
                    </div>
                </div>
                <div class="score-chip ${synergyTier}">
                    <span class="score-value">${item.score}</span>
                    <span class="score-label">${tierLabels[synergyTier]}</span>
                </div>
            </div>
            <div class="card-body">
                ${reasonsList}
            </div>
        </div>
    `;
}

function createListItemHTML(item) {
    const reasonsList = item.reasons.length > 0
        ? '<ul class="synergy-reasons compact">' + item.reasons.map(r => `<li>${r}</li>`).join('') + '</ul>'
        : '<p style="color: #7f8c8d;">Sin sinergia específica detectada</p>';

    const typeLine = item.card.type_line.toLowerCase();
    let mainType = '';
    if (typeLine.includes('creature')) mainType = 'Criatura';
    else if (typeLine.includes('instant')) mainType = 'Instantáneo';
    else if (typeLine.includes('sorcery')) mainType = 'Conjuro';
    else if (typeLine.includes('artifact')) mainType = 'Artefacto';
    else if (typeLine.includes('enchantment')) mainType = 'Encantamiento';
    else if (typeLine.includes('planeswalker')) mainType = 'Planeswalker';
    else if (typeLine.includes('land')) mainType = 'Tierra';

    const synergyTier = item.score >= 20
        ? 'high'
        : item.score >= 5
            ? 'medium'
            : item.score >= 0
                ? 'low'
                : 'offcolor';

    const tierLabels = {
        high: 'Alta sinergia',
        medium: 'Media sinergia',
        low: 'Sinergia baja',
        offcolor: 'Fuera de color'
    };

    return `
        <div class="card-item list-item">
            <div class="list-item-main">
                <div class="card-name-row">
                    <div class="card-name">${item.card.name}</div>
                    ${mainType ? `<span class="card-badge">${mainType}</span>` : ''}
                </div>
                <div class="card-subtitle">${item.card.type_line}</div>
                <div class="card-meta">
                    ${item.role ? `<span class="meta-chip">Rol: ${item.role}</span>` : ''}
                    ${item.archetype ? `<span class="meta-chip subtle">Arquetipo ${item.archetype}</span>` : ''}
                    <span class="meta-chip subtle">Puntaje ${item.score}</span>
                </div>
                <div class="card-body">${reasonsList}</div>
            </div>
            <div class="list-item-score">
                <div class="score-chip ${synergyTier}">
                    <span class="score-value">${item.score}</span>
                    <span class="score-label">${tierLabels[synergyTier]}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Get card types and their counts from synergies
 *
 * @param {Object[]} synergies - Array of synergy objects
 * @returns {Object[]} Array of type objects with key, name, and count
 */
export function getCardTypes(synergies) {
    const typeCounts = {};

    synergies.forEach(item => {
        const typeLine = item.card.type_line.toLowerCase();

        if (typeLine.includes('creature')) {
            typeCounts['creature'] = (typeCounts['creature'] || 0) + 1;
        }
        if (typeLine.includes('instant')) {
            typeCounts['instant'] = (typeCounts['instant'] || 0) + 1;
        }
        if (typeLine.includes('sorcery')) {
            typeCounts['sorcery'] = (typeCounts['sorcery'] || 0) + 1;
        }
        if (typeLine.includes('artifact')) {
            typeCounts['artifact'] = (typeCounts['artifact'] || 0) + 1;
        }
        if (typeLine.includes('enchantment')) {
            typeCounts['enchantment'] = (typeCounts['enchantment'] || 0) + 1;
        }
        if (typeLine.includes('planeswalker')) {
            typeCounts['planeswalker'] = (typeCounts['planeswalker'] || 0) + 1;
        }
        if (typeLine.includes('land')) {
            typeCounts['land'] = (typeCounts['land'] || 0) + 1;
        }
    });

    const typeNames = {
        'creature': 'Criaturas',
        'instant': 'Instantáneos',
        'sorcery': 'Conjuros',
        'artifact': 'Artefactos',
        'enchantment': 'Encantamientos',
        'planeswalker': 'Planeswalkers',
        'land': 'Tierras'
    };

    return Object.entries(typeCounts)
        .map(([key, count]) => ({ key, name: typeNames[key], count }))
        .sort((a, b) => b.count - a.count);
}

function getFilteredSynergies() {
    if (activeTypeFilter === 'all') {
        return allSynergies;
    }

    return allSynergies.filter(item => {
        const typeLine = item.card.type_line.toLowerCase();
        return typeLine.includes(activeTypeFilter);
    });
}

/**
 * Filter results by card type
 *
 * @param {string} type - Type key ('all', 'creature', 'instant', etc.)
 * @param {Event} event - Click event
 */
export function filterByType(type, event) {
    activeTypeFilter = type;

    logger.debug('Filtering by type:', type);

    const filtered = getFilteredSynergies();

    logger.info('Filtered results:', filtered.length, 'cards');

    const filteredDiv = document.getElementById('filteredResults');
    if (filteredDiv) {
        filteredDiv.innerHTML = renderFilteredResults(filtered);
    }

    // Update filter counter
    const counterDiv = document.getElementById('filterCounter');
    if (counterDiv) {
        counterDiv.innerHTML = `
            <strong style="color: #f39c12;">${filtered.length}</strong>
            <span style="color: #95a5a6;"> carta${filtered.length !== 1 ? 's' : ''} mostrada${filtered.length !== 1 ? 's' : ''}</span>
        `;
    }

    // Update filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

export function toggleViewMode(view, event) {
    if (viewMode === view) return;
    viewMode = view;

    const filtered = getFilteredSynergies();

    const filteredDiv = document.getElementById('filteredResults');
    if (filteredDiv) {
        filteredDiv.innerHTML = renderFilteredResults(filtered);
    }

    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

/**
 * Get all synergies (for external access)
 *
 * @returns {Object[]} Array of all synergy objects
 */
export function getAllSynergies() {
    return allSynergies;
}
