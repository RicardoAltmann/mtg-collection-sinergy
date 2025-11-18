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
    isAuthEnabled,
    onAuthReady
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
    removeFromCollectionUI,
    setCollectionViewMode
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
import { filterByType, toggleViewMode, handleCardFeedback, clearAnalysis } from './components/results.js';
import { showOnboarding, closeOnboarding, showDemoModeMessage } from './components/onboarding.js';
import { addCards } from './components/addCards.js';
import { initAdmin } from './components/admin.js';
import { initNotifications } from './components/notifications.js';

// Synergy engine
import {
    analyzesynergy,
    loadSavedAnalysis,
    saveAnalysisResults
} from './synergy/engine.js';

// Set log level (DEBUG for development, INFO for production)
logger.setLevel(LogLevel.INFO);

/**
 * Enable or disable action buttons
 * @param {boolean} enabled - Whether to enable the buttons
 */
function setActionButtonsEnabled(enabled) {
    const buttonIds = [
        'addBtn',
        'addCardFromAutocompleteBtn',
        'analyzeBtn',
        'clearCollectionBtn'
    ];

    buttonIds.forEach(id => {
        const button = document.getElementById(id);
        if (button) {
            button.disabled = !enabled;
            if (!enabled) {
                button.title = 'Cargando autenticación...';
            } else {
                button.title = '';
            }
        }
    });

    logger.info('Action buttons', enabled ? 'enabled' : 'disabled');
}

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

            // Register callback to enable buttons when auth is ready
            onAuthReady(() => {
                logger.info('Auth initialization complete, enabling action buttons');
                setActionButtonsEnabled(true);
            });

            // Import Supabase from CDN
            import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(module => {
                const { createClient } = module;
                const client = createClient(config.supabaseUrl, config.supabaseAnonKey);
                setSupabaseClient(client);
                initAuth();
            }).catch(error => {
                logger.error('Error loading Supabase:', error);
                showDemoModeMessage('Error al cargar autenticación. Por favor recarga la página.');
                // Enable buttons even on error so user can try again
                setActionButtonsEnabled(true);
            });
        } else {
            logger.info('No authentication configured, showing demo mode');
            showDemoModeMessage();
            // Enable buttons in demo mode
            setActionButtonsEnabled(true);
        }
    } catch (error) {
        logger.error('Error fetching config:', error);
        showDemoModeMessage('Error al cargar configuración. Usando modo demo.');
        // Enable buttons even on error
        setActionButtonsEnabled(true);
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
    window.setCollectionViewMode = setCollectionViewMode;

    // Synergy engine
    window.analyzesynergy = analyzesynergy;
    window.loadSavedAnalysis = loadSavedAnalysis;
    window.saveAnalysisResults = saveAnalysisResults;

    // Results functions
    window.filterByTypeUI = filterByType;
    window.toggleCollapseUI = toggleCollapse;
    window.toggleViewModeUI = toggleViewMode;
    window.handleCardFeedbackUI = handleCardFeedback;
    window.clearAnalysis = clearAnalysis;

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

        // Disable action buttons until auth is ready
        setActionButtonsEnabled(false);

        // Initialize notifications system
        initNotifications();

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                switchTab(tabName, e);
            });
        });

        // Auth tab switching
        const loginTab = document.getElementById('loginTab');
        const registerTab = document.getElementById('registerTab');
        if (loginTab) loginTab.addEventListener('click', () => switchAuthTab('login'));
        if (registerTab) registerTab.addEventListener('click', () => switchAuthTab('register'));

        // Login form
        const loginEmailInput = document.getElementById('loginEmail');
        const loginPasswordInput = document.getElementById('loginPassword');
        const loginBtn = document.getElementById('loginBtn');

        if (loginEmailInput) {
            loginEmailInput.addEventListener('input', () => {
                validateEmail(loginEmailInput, 'loginEmailValidation');
            });
        }
        if (loginPasswordInput) {
            loginPasswordInput.addEventListener('input', validateLoginPassword);
        }
        if (loginBtn) {
            loginBtn.addEventListener('click', login);
        }

        // Register form
        const registerEmailInput = document.getElementById('registerEmail');
        const registerPasswordInput = document.getElementById('registerPassword');
        const registerBtn = document.getElementById('registerBtn');

        if (registerEmailInput) {
            registerEmailInput.addEventListener('input', () => {
                validateEmail(registerEmailInput, 'registerEmailValidation');
            });
        }
        if (registerPasswordInput) {
            registerPasswordInput.addEventListener('input', validateRegisterPassword);
        }
        if (registerBtn) {
            registerBtn.addEventListener('click', register);
        }

        // Collection view toggle
        const collectionListViewBtn = document.getElementById('collectionListViewBtn');
        const collectionGridViewBtn = document.getElementById('collectionGridViewBtn');
        if (collectionListViewBtn) collectionListViewBtn.addEventListener('click', () => setCollectionViewMode('list'));
        if (collectionGridViewBtn) collectionGridViewBtn.addEventListener('click', () => setCollectionViewMode('grid'));

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                // Close dropdown before logout
                const dropdown = document.getElementById('userDropdown');
                if (dropdown) {
                    dropdown.classList.add('hidden');
                }
                logout();
            });
        }

        // User menu toggle
        const userMenuToggle = document.getElementById('userMenuToggle');
        const userDropdown = document.getElementById('userDropdown');

        if (userMenuToggle && userDropdown && !userMenuToggle.dataset.toggleBound) {
            const toggleMenu = (e) => {
                e.stopPropagation();
                const isHidden = userDropdown.classList.toggle('hidden');
                userMenuToggle.classList.toggle('open', !isHidden);
            };

            const closeMenu = (e) => {
                if (!userDropdown.contains(e.target) && !userMenuToggle.contains(e.target)) {
                    userDropdown.classList.add('hidden');
                    userMenuToggle.classList.remove('open');
                }
            };

            userMenuToggle.addEventListener('click', toggleMenu);
            document.addEventListener('click', closeMenu);
            userMenuToggle.dataset.toggleBound = 'true';
            userDropdown.dataset.outsideHandlerBound = 'true';
        }

        // Analyze button
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', analyzesynergy);
        }

        // Add cards button
        const addBtn = document.getElementById('addBtn');
        if (addBtn) {
            addBtn.addEventListener('click', addCards);
        }

        // Add card from autocomplete button
        const addCardFromAutocompleteBtn = document.getElementById('addCardFromAutocompleteBtn');
        if (addCardFromAutocompleteBtn) {
            addCardFromAutocompleteBtn.addEventListener('click', addCardFromAutocomplete);
        }

        // Clear collection button
        const clearCollectionBtn = document.getElementById('clearCollectionBtn');
        if (clearCollectionBtn) {
            clearCollectionBtn.addEventListener('click', async () => {
                if (confirm('¿Seguro que quieres eliminar todas las cartas de tu colección?')) {
                    try {
                        const { clearCollection } = await import('./api/collection.js');
                        await clearCollection();
                        // Reload and refresh UI
                        await loadCollection();
                        updateCollectionCount();
                        filterCollection();
                    } catch (error) {
                        logger.error('Error clearing collection:', error);
                        alert('Error al limpiar la colección: ' + error.message);
                    }
                }
            });
        }

        // Clear analysis button
        const clearAnalysisBtn = document.getElementById('clearAnalysisBtn');
        if (clearAnalysisBtn) {
            clearAnalysisBtn.addEventListener('click', () => {
                if (confirm('¿Seguro que quieres limpiar el análisis actual?')) {
                    clearAnalysis();
                }
            });
        }

        // Search and sort collection
        const searchInput = document.getElementById('searchCollection');
        const sortSelect = document.getElementById('sortCollection');

        if (searchInput) {
            searchInput.addEventListener('input', filterCollection);
        }
        if (sortSelect) {
            sortSelect.addEventListener('change', filterCollection);
        }

        // Onboarding modal
        const closeOnboardingBtn = document.getElementById('closeOnboardingBtn');
        if (closeOnboardingBtn) {
            closeOnboardingBtn.addEventListener('click', closeOnboarding);
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
