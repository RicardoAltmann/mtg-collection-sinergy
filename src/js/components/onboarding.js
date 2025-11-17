/**
 * Onboarding component
 * Shows welcome modal for first-time users
 * @module components/onboarding
 */

import { logger } from '../utils/logger.js';
import { getCurrentUser, isAuthEnabled } from '../api/supabase.js';

/**
 * Show the onboarding modal
 */
export function showOnboarding() {
    const modal = document.getElementById('onboardingModal');
    if (modal) {
        modal.classList.remove('hidden');
        logger.info('Onboarding modal shown');
    } else {
        logger.warn('Onboarding modal element not found');
    }
}

/**
 * Close the onboarding modal and mark as seen
 */
export function closeOnboarding() {
    try {
        const modal = document.getElementById('onboardingModal');
        if (modal) {
            modal.classList.add('hidden');
        }

        const USE_AUTH = isAuthEnabled();
        const currentUser = getCurrentUser();
        const onboardingKey = USE_AUTH && currentUser ? `onboarding_seen_${currentUser.id}` : 'onboarding_seen';

        localStorage.setItem(onboardingKey, 'true');
        logger.info('Onboarding closed and marked as seen');
    } catch (error) {
        logger.error('Error closing onboarding:', error);
        // Ensure modal is closed even if there's an error
        const modal = document.getElementById('onboardingModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
}

/**
 * Show demo mode message when authentication is not configured
 *
 * @param {string} [customMessage=null] - Custom message to display
 */
export async function showDemoModeMessage(customMessage = null) {
    const mainApp = document.getElementById('mainApp');
    const authContainer = document.getElementById('authContainer');

    if (!authContainer || !mainApp) {
        logger.warn('Required elements for demo mode message not found');
        return;
    }

    // Hide auth container in demo mode
    authContainer.classList.add('hidden');

    // Show main app with demo message
    mainApp.classList.remove('hidden');

    // Check if demo message already exists to avoid duplicates
    if (!document.querySelector('.demo-mode-message')) {
        mainApp.insertAdjacentHTML('afterbegin', `
            <div class="demo-mode-message success-message" style="background: rgba(243, 156, 18, 0.2); border-color: #f39c12; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #f39c12;">🎮 Modo Demo</h3>
                <p style="margin: 0 0 10px 0;">
                    ${customMessage || 'Esta aplicación funciona sin autenticación configurada. Tus datos se guardarán localmente en este navegador.'}
                </p>
                <details style="margin-top: 10px;">
                    <summary style="cursor: pointer; font-weight: 600; color: #f39c12;">
                        ℹ️ ¿Cómo habilitar autenticación multi-usuario?
                    </summary>
                    <div style="margin-top: 10px; padding-left: 10px; border-left: 2px solid #f39c12;">
                        <p style="margin: 5px 0;">1. Crea una cuenta en <a href="https://supabase.com" target="_blank" style="color: #3498db;">Supabase</a></p>
                        <p style="margin: 5px 0;">2. Configura las variables SUPABASE_URL y SUPABASE_ANON_KEY en el código</p>
                        <p style="margin: 5px 0;">3. Cada usuario tendrá su propia colección protegida</p>
                    </div>
                </details>
            </div>
        `);
    }

    logger.info('Demo mode message displayed');

    // Load collection and update UI
    try {
        const { loadCollection } = await import('../api/collection.js');
        const { updateCollectionCount } = await import('./collection.js');

        await loadCollection();
        updateCollectionCount();
    } catch (error) {
        logger.error('Error loading collection in demo mode:', error);
    }

    // Show onboarding modal for first-time users in demo mode
    const onboardingKey = 'onboarding_seen';
    if (!localStorage.getItem(onboardingKey)) {
        showOnboarding();
    }
}
