/**
 * Core synergy analysis engine
 * Main orchestration for analyzing card synergies with commanders
 * @module synergy/engine
 */

import { logger } from '../utils/logger.js';
import { countColorPips, extractCreatureTypes, isPermanentType } from '../utils/helpers.js';
import { STAPLES, KNOWN_COMBOS, ARCHETYPE_WEIGHTS } from '../utils/constants.js';
import { fetchCardData } from '../api/scryfall.js';
import { loadCollection, getCollectionData } from '../api/collection.js';
import { fetchEDHRecData, applyEDHRecBoost } from '../api/edhrec.js';
import { getCurrentUser, isAuthEnabled } from '../api/supabase.js';
import { detectArchetype, detectCardRole, analyzeCollectionBalance } from './archetype.js';
import { detectConceptSynergies, detectAdvancedAntiSynergies } from './concepts.js';
import { displayResults, setCommanderData } from '../components/results.js';
import { getCardFeedbackAdjustment, loadFeedbackPreferences } from '../utils/feedback.js';

// Global state for synergy analysis
let commanderData = null;
let cardCollection = [];

/**
 * Main synergy analysis function
 * Orchestrates the entire analysis process
 *
 * @async
 * @returns {Promise<void>}
 */
export async function analyzesynergy() {
    const commanderName = document.getElementById('commander').value.trim();
    const resultsDiv = document.getElementById('results');
    const analyzeBtn = document.getElementById('analyzeBtn');

    if (!commanderName) {
        resultsDiv.innerHTML = '<div class="error">Por favor ingresa el nombre del commander</div>';
        return;
    }

    // Load collection first
    await loadCollection();
    const allCollectionData = getCollectionData();

    if (allCollectionData.length === 0) {
        resultsDiv.innerHTML = '<div class="error">Tu colección está vacía. Ve a "Agregar Cartas" para empezar.</div>';
        return;
    }

    analyzeBtn.disabled = true;
    resultsDiv.innerHTML = '<div class="loading">🔍 Buscando commander...</div>';

    try {
        // Fetch commander data
        logger.info('Fetching commander:', commanderName);
        commanderData = await fetchCardData(commanderName);
        setCommanderData(commanderData);

        resultsDiv.innerHTML = `
            <div class="loading">
                🔍 Analizando ${allCollectionData.length} cartas de tu colección...
            </div>
        `;

        // Use the collection data directly
        cardCollection = allCollectionData;

        // Fetch EDHRec data
        resultsDiv.innerHTML = `
            <div class="loading">
                🌐 Obteniendo datos de EDHRec para ${commanderData.name}...
            </div>
        `;
        const edhrecData = await fetchEDHRecData(commanderData.name);

        resultsDiv.innerHTML = `
            <div class="loading">
                🧮 Calculando sinergias con análisis avanzado...
            </div>
        `;

        // Analyze synergies with EDHRec data
        const synergies = calculateSynergies(edhrecData);
        displayResults(synergies, []);

    } catch (error) {
        logger.error('Analysis error:', error);
        resultsDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    } finally {
        analyzeBtn.disabled = false;
    }
}

/**
 * Calculate synergies between collection cards and commander
 *
 * @param {Object} [edhrecData=null] - EDHRec data for the commander
 * @returns {Object[]} Array of synergy objects sorted by score
 */
export function calculateSynergies(edhrecData = null) {
    const commanderColors = commanderData.color_identity || [];
    const commanderText = (commanderData.oracle_text || '').toLowerCase();
    const commanderTypes = (commanderData.type_line || '').toLowerCase();
    const commanderKeywords = commanderData.keywords || [];
    const commanderCMC = commanderData.cmc || 0;
    const feedbackConfig = loadFeedbackPreferences();
    const permanentTypes = feedbackConfig.permanentTypes;

    // Detect archetype of the commander
    const archetype = detectArchetype(commanderData);
    const archetypeWeights = ARCHETYPE_WEIGHTS[archetype] || ARCHETYPE_WEIGHTS.midrange;

    logger.info(`Archetype detected: ${archetype.toUpperCase()}`);
    if (edhrecData && (edhrecData.topCards?.length > 0 || edhrecData.highSynergy?.length > 0)) {
        logger.info(`EDHRec data: ${edhrecData.topCards.length} top cards, ${edhrecData.highSynergy.length} high synergy cards`);
    }

    const initialResults = cardCollection.map(card => {
        const reasons = [];
        let score = 0;

        // Color identity match
        const cardColors = card.color_identity || [];
        const colorMatch = cardColors.every(color => commanderColors.includes(color));
        if (!colorMatch) {
            score -= 50;
            reasons.push('❌ Fuera de identidad de color');
        }

        const cardText = (card.oracle_text || '').toLowerCase();
        const cardTypes = (card.type_line || '').toLowerCase();
        const cardCMC = card.cmc || 0;
        const cardName = card.name.toLowerCase();

        // Detect card role
        const cardRole = detectCardRole(card);

        // Mana curve analysis
        // Early game (CMC 0-2): ramp, early interaction
        if (cardCMC <= 2 && colorMatch) {
            if (cardText.includes('mana') || cardTypes.includes('artifact') &&
                (cardText.includes('add') || cardText.includes('tap'))) {
                score += 8;
                reasons.push('✓ Ramp temprano (CMC ≤2)');
            } else if (cardText.includes('destroy') || cardText.includes('counter') ||
                       cardText.includes('remove') || cardText.includes('exile')) {
                score += 5;
                reasons.push('✓ Interacción temprana (CMC ≤2)');
            }
        }

        // Mid game (CMC 3-5): value engines
        if (cardCMC >= 3 && cardCMC <= 5 && colorMatch) {
            if (cardText.includes('draw') || cardText.includes('search')) {
                score += 3;
                reasons.push('✓ Motor de valor mid-game');
            }
        }

        // Late game payoff (CMC 6+): only valuable if deck can ramp
        if (cardCMC >= 6 && colorMatch) {
            if (commanderText.includes('land') || commanderText.includes('mana') ||
                commanderText.includes('ramp')) {
                score += 5;
                reasons.push('✓ Payoff late-game para deck con ramp');
            } else {
                score -= 3;
                reasons.push('⚠ Carta cara sin clara sinergia de ramp');
            }
        }

        // Keyword synergies
        commanderKeywords.forEach(keyword => {
            if (cardText.includes(keyword.toLowerCase())) {
                score += 15;
                reasons.push(`✓ Comparte keyword: ${keyword}`);
            }
        });

        // +1/+1 counter synergy
        if (commanderText.includes('+1/+1 counter') || commanderText.includes('proliferate')) {
            if (cardText.includes('+1/+1 counter') || cardText.includes('proliferate')) {
                score += 20;
                reasons.push('✓ Sinergia de contadores +1/+1');
            }
        }

        // Tribal synergies
        const commanderCreatureTypes = extractCreatureTypes(commanderTypes);
        const cardCreatureTypes = extractCreatureTypes(cardTypes);
        commanderCreatureTypes.forEach(type => {
            if (cardText.includes(type) || cardCreatureTypes.includes(type)) {
                score += 15;
                reasons.push(`✓ Sinergia tribal: ${type}`);
            }
        });

        // Card draw synergy
        if (commanderText.includes('draw') && cardText.includes('draw')) {
            score += 10;
            reasons.push('✓ Ambas cartas roban cartas');
        }

        // Ramp synergy
        if ((commanderText.includes('land') || commanderTypes.includes('land')) &&
            (cardText.includes('search') && cardText.includes('land'))) {
            score += 12;
            reasons.push('✓ Rampeo de tierras');
        }

        // Sacrifice synergy
        if (commanderText.includes('sacrifice') && cardText.includes('sacrifice')) {
            score += 12;
            reasons.push('✓ Sinergia de sacrificio');
        }

        // ETB synergy
        if (commanderText.includes('enters the battlefield') && cardText.includes('enters the battlefield')) {
            score += 10;
            reasons.push('✓ Sinergia ETB');
        }

        // Graveyard synergy
        if ((commanderText.includes('graveyard') || commanderText.includes('return') && commanderText.includes('battlefield')) &&
            (cardText.includes('graveyard') || cardText.includes('return') && cardText.includes('battlefield'))) {
            score += 12;
            reasons.push('✓ Sinergia de cementerio');
        }

        // Token synergy
        if (commanderText.includes('token') && cardText.includes('token')) {
            score += 10;
            reasons.push('✓ Sinergia de tokens');
        }

        // Removal/Protection
        if (cardText.includes('destroy') || cardText.includes('exile') || cardText.includes('counter') ||
            cardText.includes('protection') || cardText.includes('indestructible')) {
            score += 5;
            reasons.push('✓ Remoción o protección');
        }

        // Anti-synergies
        // Board wipes that kill commander
        if (cardText.includes('destroy all creatures') || cardText.includes('exile all creatures') ||
            cardText.includes('-x/-x') && cardText.includes('all')) {
            if (commanderTypes.includes('creature')) {
                // Check if it's asymmetric (spares our commander)
                const isAsymmetric = cardText.includes('you control') ||
                                   cardText.includes('target opponent') ||
                                   cardText.includes('choose');
                if (!isAsymmetric) {
                    score -= 8;
                    reasons.push('⚠ Board wipe que destruye tu comandante');
                }
            }
        }

        // Nonbo: Stax pieces against our plan
        if (cardText.includes('can\'t cast') || cardText.includes('can\'t activate')) {
            if (commanderText.includes('cast') || commanderText.includes('activate')) {
                score -= 5;
                reasons.push('⚠ Puede frenar tu estrategia');
            }
        }

        // Staples
        let isStaple = false;
        for (const [category, cards] of Object.entries(STAPLES)) {
            if (cards.includes(cardName)) {
                isStaple = true;
                score += 15;
                reasons.push(`✓ Staple de formato (${category})`);
                break;
            }
        }

        // Combo detection
        if (KNOWN_COMBOS[cardName]) {
            const comboPieces = KNOWN_COMBOS[cardName];
            const hasOtherPiece = cardCollection.some(c =>
                comboPieces.includes(c.name.toLowerCase())
            );
            if (hasOtherPiece) {
                score += 25;
                reasons.push(`✓ Combo conocido: ${comboPieces.join(' + ')}`);
            } else {
                score += 8;
                reasons.push(`✓ Pieza de combo (necesita: ${comboPieces.join(' / ')})`);
            }
        }

        // Bonus: Commander is part of the combo
        const commanderNameLower = (commanderData.name || '').toLowerCase();
        if (KNOWN_COMBOS[commanderNameLower]) {
            if (KNOWN_COMBOS[commanderNameLower].includes(cardName)) {
                score += 30;
                reasons.push('✓ Combo directo con tu comandante!');
            }
        }

        // Devotion/chroma analysis
        if (commanderText.includes('devotion') || commanderText.includes('chroma')) {
            const cardPips = countColorPips(card.mana_cost, commanderColors);
            if (cardPips > 0) {
                const pipBonus = cardPips * 3;
                score += pipBonus;
                reasons.push(`✓ ${cardPips} pips para devotion/chroma (+${pipBonus})`);
            }
        }

        // Commanders that count permanents of a color
        commanderColors.forEach(color => {
            const colorName = {W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green'}[color];
            if (!colorName || !cardColors.includes(color)) return;

            const countsPermanents = commanderText.includes(colorName) && commanderText.includes('permanent');
            const countsSpells = commanderText.includes(colorName) && commanderText.includes('spell');

            if (countsPermanents && isPermanentType(cardTypes, permanentTypes)) {
                score += feedbackConfig?.weights?.coloredPermanent ?? 4;
                reasons.push(`✓ Permanente ${colorName} para habilidad del comandante`);
            } else if (countsSpells && !isPermanentType(cardTypes, permanentTypes)) {
                score += 3;
                reasons.push(`✓ Hechizo ${colorName} que escala la habilidad del comandante`);
            }
        });

        // Semantic concept analysis
        const conceptSynergy = detectConceptSynergies(card, commanderData);
        score += conceptSynergy.totalScore;
        conceptSynergy.matchedConcepts.forEach(concept => {
            reasons.push(`✓ Concepto: ${concept.description} (+${concept.score})`);
        });

        // EDHRec boost
        if (edhrecData) {
            const edhrecBoost = applyEDHRecBoost(card, edhrecData);
            score += edhrecBoost.boost;
            reasons.push(...edhrecBoost.reasons);
        }

        // Advanced anti-synergies
        const advancedAntiSynergies = detectAdvancedAntiSynergies(card, commanderData);
        advancedAntiSynergies.forEach(penalty => {
            score += penalty.score;
            reasons.push(penalty.reason);
        });

        // Archetype weighting
        // Apply multiplier based on archetype and card role
        let archetypeMultiplier = 1.0;
        if (archetypeWeights[cardRole]) {
            archetypeMultiplier = archetypeWeights[cardRole];
        }

        // Only apply multiplier to positive scores
        if (score > 0 && archetypeMultiplier !== 1.0) {
            const oldScore = score;
            score = Math.round(score * archetypeMultiplier);

            // Inform if significant change (>10%)
            if (Math.abs(archetypeMultiplier - 1.0) > 0.2) {
                const change = score - oldScore;
                if (change > 0) {
                    reasons.push(`✓ Rol ideal para ${archetype}: ${cardRole} (+${change})`);
                } else if (change < 0) {
                    reasons.push(`⚠ Rol menos útil para ${archetype}: ${cardRole} (${change})`);
                }
            }
        }

        // Fold in user feedback without requiring a per-card form
        const feedbackAdjustment = getCardFeedbackAdjustment(cardName);
        if (feedbackAdjustment.adjustment !== 0) {
            score += feedbackAdjustment.adjustment;
            const sentiment = feedbackAdjustment.adjustment > 0 ? '👍 Feedback positivo' : '👎 Feedback negativo';
            reasons.push(`${sentiment} (${feedbackAdjustment.totalVotes} votos)`);
        }

        return {
            card: card,
            score: score,
            reasons: reasons,
            role: cardRole,
            archetype: archetype
        };
    });

    // Collection balance analysis
    // Apply adjustments based on role balance and mana curve
    const balancedResults = analyzeCollectionBalance(initialResults, archetype);

    return balancedResults.sort((a, b) => b.score - a.score);
}

/**
 * Load saved analysis from localStorage
 */
export function loadSavedAnalysis() {
    const USE_AUTH = isAuthEnabled();
    const currentUser = getCurrentUser();

    if (!USE_AUTH || !currentUser) return;

    const savedKey = `analysis_${currentUser.id}`;
    const saved = localStorage.getItem(savedKey);

    if (saved) {
        try {
            const { commanderData: savedCommander, synergies, timestamp } = JSON.parse(saved);

            // Show saved results if less than 24 hours old
            const age = Date.now() - timestamp;
            if (age < 24 * 60 * 60 * 1000) {
                logger.info('Loading saved analysis:', savedCommander.name);
                commanderData = savedCommander;
                setCommanderData(commanderData);
                displayResults(synergies, []);
            } else {
                // Clear old results
                localStorage.removeItem(savedKey);
                logger.info('Cleared old saved analysis');
            }
        } catch (e) {
            logger.error('Error loading saved analysis:', e);
        }
    }
}

/**
 * Save analysis results to localStorage
 *
 * @param {Object[]} synergies - Synergy results to save
 */
export function saveAnalysisResults(synergies) {
    const USE_AUTH = isAuthEnabled();
    const currentUser = getCurrentUser();

    if (!USE_AUTH || !currentUser) return;

    const savedKey = `analysis_${currentUser.id}`;
    const dataToSave = {
        commanderData,
        synergies,
        timestamp: Date.now()
    };

    try {
        localStorage.setItem(savedKey, JSON.stringify(dataToSave));
        logger.info('Analysis results saved');
    } catch (e) {
        logger.error('Error saving analysis:', e);
    }
}

/**
 * Get current commander data
 *
 * @returns {Object|null} Commander data or null
 */
export function getCommanderData() {
    return commanderData;
}
