/**
 * Main entry point for MTG Collection Synergy Analyzer
 * Initializes the application and sets up all event listeners
 * @module main
 */

import { logger, LogLevel } from './utils/logger.js';

// API modules
import {
    initAuth,
    setAuthConfig,
    setSupabaseClient,
    isAuthEnabled
} from './api/supabase.js';
import { loadCollection } from './api/collection.js';

// Component modules
import {
    showMainApp,
    showAuthForms,
    switchAuthTab,
    validateEmail,
    validateLoginPassword,
    validateRegisterPassword,
    login,
    register,
    logout
} from './components/auth.js';
import { switchTab, toggleCollapse } from './components/tabs.js';
import {
    displayCollection,
    filterCollection,
    updateCollectionCount,
    removeFromCollectionUI
} from './components/collection.js';
import {
    initAutocomplete,
    selectSuggestion,
    addCardFromAutocomplete
} from './components/autocomplete.js';
import {
    initFileImport,
    handleFileSelect,
    downloadTemplate
} from './components/fileImport.js';
import { filterByType } from './components/results.js';
import { showOnboarding, closeOnboarding, showDemoModeMessage } from './components/onboarding.js';

// Synergy engine
import {
    analyzesynergy,
    loadSavedAnalysis,
    saveAnalysisResults
} from './synergy/engine.js';

// Set log level (DEBUG for development, INFO for production)
logger.setLevel(LogLevel.INFO);

/**
 * Initialize the application
 * Fetches configuration and sets up Supabase if enabled
 */
async function initializeApp() {
    try {
        logger.info('Initializing application...');

        const response = await fetch('/api/config');
        const config = await response.json();

        setAuthConfig({
            supabaseUrl: config.supabaseUrl,
            supabaseAnonKey: config.supabaseAnonKey,
            useAuth: config.useAuth
        });

        if (config.useAuth) {
            logger.info('Authentication enabled, loading Supabase...');
            // Import Supabase from CDN
            import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(module => {
                const { createClient } = module;
                const client = createClient(config.supabaseUrl, config.supabaseAnonKey);
                setSupabaseClient(client);
                initAuth();
            }).catch(error => {
                logger.error('Error loading Supabase:', error);
                showDemoModeMessage('Error al cargar autenticación. Por favor recarga la página.');
            });
        } else {
            logger.info('No authentication configured, showing demo mode');
            showDemoModeMessage();
        }
    } catch (error) {
        logger.error('Error fetching config:', error);
        showDemoModeMessage('Error al cargar configuración. Usando modo demo.');
    }
}

/**
 * Set up global window functions for onclick handlers
 * This makes functions accessible from inline event handlers in HTML
 */
function setupGlobalFunctions() {
    // Auth functions
    window.switchAuthTab = switchAuthTab;
    window.validateEmail = validateEmail;
    window.validateLoginPassword = validateLoginPassword;
    window.validateRegisterPassword = validateRegisterPassword;
    window.login = login;
    window.register = register;
    window.logout = logout;

    // Tab functions
    window.switchTab = switchTab;

    // Onboarding
    window.showOnboarding = showOnboarding;
    window.closeOnboarding = closeOnboarding;

    // Collection functions
    window.filterCollection = filterCollection;
    window.removeFromCollectionUI = removeFromCollectionUI;

    // Synergy engine
    window.analyzesynergy = analyzesynergy;
    window.loadSavedAnalysis = loadSavedAnalysis;
    window.saveAnalysisResults = saveAnalysisResults;

    // Results functions
    window.filterByTypeUI = filterByType;
    window.toggleCollapseUI = toggleCollapse;

    // Autocomplete functions
    window.selectSuggestionFromAutocomplete = selectSuggestion;
    window.addCardFromAutocomplete = addCardFromAutocomplete;

    // File import functions
    window.handleFileSelect = handleFileSelect;
    window.downloadTemplate = downloadTemplate;

    logger.info('Global functions registered');
}

/**
 * Initialize event listeners when DOM is ready
 */
function initEventListeners() {
    window.addEventListener('DOMContentLoaded', () => {
        logger.info('DOM loaded, setting up event listeners...');

        // Load collection if not using auth
        if (!isAuthEnabled()) {
            loadCollection().catch(error => {
                logger.error('Failed to load collection on startup:', error);
            });
        }

        // Initialize autocomplete
        initAutocomplete();

        // Initialize file import drag & drop
        initFileImport();

        logger.info('Event listeners initialized');
    });
}

/**
 * Main initialization
 */
function init() {
    logger.info('MTG Collection Synergy Analyzer starting...');

    // Set up global functions
    setupGlobalFunctions();

    // Initialize app
    initializeApp();

    // Set up event listeners
    initEventListeners();

    logger.info('Initialization complete');
}

// Start the application
init();

// Export for external use if needed
export {
    init,
    logger,
    LogLevel
};
