/**
 * Authentication UI component
 * Handles login, registration, and authentication state UI updates
 * @module components/auth
 */

import { logger } from '../utils/logger.js';
import { getSupabaseClient, getCurrentUser, isAuthEnabled } from '../api/supabase.js';
import { loadCollection } from '../api/collection.js';

/**
 * Show the main application UI (hide auth forms)
 * Displays user info and loads collection
 *
 * @async
 * @returns {Promise<void>}
 */
export async function showMainApp() {
    const currentUser = getCurrentUser();

    logger.info('Showing main app for user:', currentUser?.email);

    document.getElementById('authContainer').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('userEmail').textContent = currentUser.email;

    // Load user's collection and display it
    await loadCollection();

    // Update UI with collection data
    const { updateCollectionCount, filterCollection } = await import('./collection.js');
    updateCollectionCount();
    filterCollection();

    // Load saved analysis results (will be handled by synergy/engine module)
    if (window.loadSavedAnalysis) {
        window.loadSavedAnalysis();
    }

    // Show onboarding modal for first-time users
    const USE_AUTH = isAuthEnabled();
    const onboardingKey = USE_AUTH && currentUser ? `onboarding_seen_${currentUser.id}` : 'onboarding_seen';
    if (!localStorage.getItem(onboardingKey)) {
        if (window.showOnboarding) {
            window.showOnboarding();
        }
    }
}

/**
 * Show authentication forms (hide main app)
 */
export function showAuthForms() {
    logger.info('Showing auth forms');

    document.getElementById('authContainer').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('userInfo').classList.add('hidden');
}

/**
 * Switch between login and register tabs
 *
 * @param {string} tab - Tab name ('login' or 'register')
 */
export function switchAuthTab(tab) {
    logger.debug('Switching auth tab to:', tab);

    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

    if (tab === 'login') {
        document.querySelectorAll('.auth-tab')[0].classList.add('active');
        document.getElementById('loginForm').classList.add('active');
    } else {
        document.querySelectorAll('.auth-tab')[1].classList.add('active');
        document.getElementById('registerForm').classList.add('active');
    }
}

/**
 * Validate email format
 *
 * @param {HTMLInputElement} input - Email input element
 * @param {string} validationId - ID of the validation message div
 * @returns {boolean} True if email is valid
 */
export function validateEmail(input, validationId) {
    const validationDiv = document.getElementById(validationId);
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const email = input.value.trim();

    if (email === '') {
        input.classList.remove('valid', 'invalid');
        validationDiv.textContent = '';
        validationDiv.classList.remove('success', 'error');
        return false;
    }

    if (emailPattern.test(email)) {
        input.classList.remove('invalid');
        input.classList.add('valid');
        validationDiv.textContent = '✓ Email válido';
        validationDiv.classList.remove('error');
        validationDiv.classList.add('success');
        return true;
    } else {
        input.classList.remove('valid');
        input.classList.add('invalid');
        validationDiv.textContent = '✗ Email inválido';
        validationDiv.classList.remove('success');
        validationDiv.classList.add('error');
        return false;
    }
}

/**
 * Validate login password (just checks if not empty)
 *
 * @returns {boolean} True if password is not empty
 */
export function validateLoginPassword() {
    const input = document.getElementById('loginPassword');
    const validationDiv = document.getElementById('loginPasswordValidation');
    const password = input.value;

    if (password === '') {
        input.classList.remove('valid', 'invalid');
        validationDiv.textContent = '';
        validationDiv.classList.remove('success', 'error');
        return false;
    }

    if (password.length > 0) {
        input.classList.remove('invalid');
        input.classList.add('valid');
        validationDiv.textContent = '';
        validationDiv.classList.remove('error');
        return true;
    } else {
        input.classList.remove('valid');
        input.classList.add('invalid');
        validationDiv.textContent = '✗ Contraseña requerida';
        validationDiv.classList.add('error');
        return false;
    }
}

/**
 * Validate registration password (minimum 6 characters)
 *
 * @returns {boolean} True if all password requirements are met
 */
export function validateRegisterPassword() {
    const input = document.getElementById('registerPassword');
    const password = input.value;

    const reqLength = document.getElementById('req-length');
    const reqNotEmpty = document.getElementById('req-notempty');

    let allMet = true;

    // Check not empty
    if (password.length > 0) {
        reqNotEmpty.classList.add('met');
    } else {
        reqNotEmpty.classList.remove('met');
        allMet = false;
    }

    // Check length
    if (password.length >= 6) {
        reqLength.classList.add('met');
    } else {
        reqLength.classList.remove('met');
        allMet = false;
    }

    // Update input border
    if (password === '') {
        input.classList.remove('valid', 'invalid');
    } else if (allMet) {
        input.classList.remove('invalid');
        input.classList.add('valid');
    } else {
        input.classList.remove('valid');
        input.classList.add('invalid');
    }

    return allMet;
}

/**
 * Handle user login
 *
 * @async
 * @returns {Promise<void>}
 */
export async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');

    if (!email || !password) {
        errorDiv.innerHTML = '<div class="error">Por favor completa todos los campos</div>';
        return;
    }

    loginBtn.disabled = true;
    errorDiv.innerHTML = '';

    logger.info('Attempting login for:', email);

    try {
        const supabaseClient = getSupabaseClient();
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        logger.info('Login successful');
        // Success - auth state change will handle UI update
    } catch (error) {
        logger.error('Login failed:', error.message);
        errorDiv.innerHTML = `<div class="error">${error.message}</div>`;
        loginBtn.disabled = false;
    }
}

/**
 * Handle user registration
 *
 * @async
 * @returns {Promise<void>}
 */
export async function register() {
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const errorDiv = document.getElementById('registerError');
    const registerBtn = document.getElementById('registerBtn');

    if (!email || !password) {
        errorDiv.innerHTML = '<div class="error">Por favor completa todos los campos</div>';
        return;
    }

    if (password.length < 6) {
        errorDiv.innerHTML = '<div class="error">La contraseña debe tener al menos 6 caracteres</div>';
        return;
    }

    registerBtn.disabled = true;
    errorDiv.innerHTML = '';

    logger.info('Attempting registration for:', email);

    try {
        const supabaseClient = getSupabaseClient();
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password
        });

        if (error) throw error;

        logger.info('Registration successful');
        errorDiv.innerHTML = '<div class="success-message">Cuenta creada exitosamente. Puedes iniciar sesión.</div>';
        setTimeout(() => switchAuthTab('login'), 2000);
    } catch (error) {
        logger.error('Registration failed:', error.message);
        errorDiv.innerHTML = `<div class="error">${error.message}</div>`;
    } finally {
        registerBtn.disabled = false;
    }
}

/**
 * Handle user logout
 *
 * @async
 * @returns {Promise<void>}
 */
export async function logout() {
    if (!confirm('¿Seguro que quieres cerrar sesión?')) return;

    logger.info('Logging out');

    try {
        const supabaseClient = getSupabaseClient();
        await supabaseClient.auth.signOut();
        // Auth state change will handle UI update
    } catch (error) {
        logger.error('Logout error:', error);
        alert('Error al cerrar sesión: ' + error.message);
    }
}
