/**
 * Supabase authentication and configuration module
 * @module api/supabase
 */

import { logger } from '../utils/logger.js';

// Supabase client and auth state
let supabaseClient = null;
let currentUser = null;
let sessionToken = null;
let SUPABASE_URL = null;
let SUPABASE_ANON_KEY = null;
let USE_AUTH = false;

/**
 * Initialize authentication system
 * Checks for existing session and sets up auth state change listeners
 *
 * @async
 * @returns {Promise<void>}
 */
export async function initAuth() {
    // Check for existing session
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
        currentUser = session.user;
        sessionToken = session.access_token;
        logger.info('User session restored:', currentUser.email);
    } else {
        logger.info('No existing session found');
    }

    // Listen for auth changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        logger.info('Auth state change:', event);
        if (session) {
            currentUser = session.user;
            sessionToken = session.access_token;
        } else {
            currentUser = null;
            sessionToken = null;
        }
    });
}

/**
 * Get authentication headers for API requests
 * Includes the session token if available
 *
 * @returns {Object} Headers object with Content-Type and optional Authorization
 */
export function getAuthHeaders() {
    const headers = {
        'Content-Type': 'application/json'
    };

    if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    return headers;
}

/**
 * Get the current user object
 *
 * @returns {Object|null} Current user or null if not authenticated
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Get the Supabase client instance
 *
 * @returns {Object|null} Supabase client or null if not initialized
 */
export function getSupabaseClient() {
    return supabaseClient;
}

/**
 * Check if authentication is enabled
 *
 * @returns {boolean} True if auth is enabled
 */
export function isAuthEnabled() {
    return USE_AUTH;
}

/**
 * Set the Supabase client (called during initialization)
 *
 * @param {Object} client - Supabase client instance
 */
export function setSupabaseClient(client) {
    supabaseClient = client;
}

/**
 * Set authentication configuration
 *
 * @param {Object} config - Configuration object
 * @param {string} config.supabaseUrl - Supabase project URL
 * @param {string} config.supabaseAnonKey - Supabase anonymous key
 * @param {boolean} config.useAuth - Whether authentication is enabled
 */
export function setAuthConfig(config) {
    SUPABASE_URL = config.supabaseUrl;
    SUPABASE_ANON_KEY = config.supabaseAnonKey;
    USE_AUTH = config.useAuth;
    logger.info('Auth config set:', { useAuth: USE_AUTH });
}

/**
 * Get authentication configuration
 *
 * @returns {Object} Configuration object
 */
export function getAuthConfig() {
    return {
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        USE_AUTH
    };
}
