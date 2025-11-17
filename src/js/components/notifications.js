/**
 * Notifications Component
 * Displays toast notifications and alerts to the user
 * @module components/notifications
 */

import { logger } from '../utils/logger.js';

// Notification types
export const NotificationType = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
};

// Active notifications
let activeNotifications = [];
let notificationIdCounter = 0;

/**
 * Initialize the notifications system
 */
export function initNotifications() {
    // Create notifications container if it doesn't exist
    if (!document.getElementById('notificationsContainer')) {
        const container = document.createElement('div');
        container.id = 'notificationsContainer';
        container.className = 'notifications-container';
        document.body.appendChild(container);
        logger.info('Notifications container initialized');
    }
}

/**
 * Show a notification
 *
 * @param {Object} options - Notification options
 * @param {string} options.message - Notification message
 * @param {string} [options.type='info'] - Notification type (info|success|warning|error)
 * @param {number} [options.duration=5000] - Duration in milliseconds (0 for permanent)
 * @param {boolean} [options.dismissible=true] - Whether notification can be dismissed
 * @param {Function} [options.onDismiss] - Callback when notification is dismissed
 * @returns {number} Notification ID
 */
export function showNotification({ message, type = NotificationType.INFO, duration = 5000, dismissible = true, onDismiss }) {
    initNotifications();

    const notificationId = notificationIdCounter++;
    const container = document.getElementById('notificationsContainer');

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type} notification-enter`;
    notification.id = `notification-${notificationId}`;
    notification.setAttribute('role', 'alert');
    notification.setAttribute('aria-live', 'polite');

    // Icon based on type
    const icons = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    };
    const icon = icons[type] || icons.info;

    // Build notification HTML
    notification.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-message">${message}</div>
        ${dismissible ? '<button class="notification-close" aria-label="Cerrar">✕</button>' : ''}
    `;

    // Add to DOM
    container.appendChild(notification);

    // Trigger entrance animation
    requestAnimationFrame(() => {
        notification.classList.remove('notification-enter');
        notification.classList.add('notification-visible');
    });

    // Setup dismiss handler
    const dismissHandler = () => {
        dismissNotification(notificationId);
        if (onDismiss) onDismiss();
    };

    if (dismissible) {
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', dismissHandler);
    }

    // Auto-dismiss after duration
    if (duration > 0) {
        setTimeout(dismissHandler, duration);
    }

    // Track active notification
    activeNotifications.push({
        id: notificationId,
        element: notification,
        dismissHandler
    });

    logger.debug('Notification shown:', { id: notificationId, type, message });

    return notificationId;
}

/**
 * Dismiss a notification
 *
 * @param {number} notificationId - ID of notification to dismiss
 */
export function dismissNotification(notificationId) {
    const notification = activeNotifications.find(n => n.id === notificationId);
    if (!notification) return;

    const element = notification.element;

    // Exit animation
    element.classList.remove('notification-visible');
    element.classList.add('notification-exit');

    // Remove from DOM after animation
    setTimeout(() => {
        element.remove();
        activeNotifications = activeNotifications.filter(n => n.id !== notificationId);
        logger.debug('Notification dismissed:', notificationId);
    }, 300);
}

/**
 * Dismiss all notifications
 */
export function dismissAllNotifications() {
    activeNotifications.forEach(notification => {
        dismissNotification(notification.id);
    });
}

/**
 * Show limit warning notification
 *
 * @param {Object} limitInfo - User limit information
 * @param {number} limitInfo.usage_percentage - Percentage of limit used
 * @param {number} limitInfo.remaining - Remaining cards
 * @param {number} limitInfo.max_cards - Maximum cards allowed
 */
export function showLimitWarning(limitInfo) {
    const { usage_percentage, remaining, max_cards } = limitInfo;

    if (usage_percentage >= 100) {
        showNotification({
            message: `🚫 Has alcanzado tu límite de ${max_cards} cartas. No puedes agregar más hasta que elimines algunas.`,
            type: NotificationType.ERROR,
            duration: 0, // Don't auto-dismiss
            dismissible: true
        });
    } else if (usage_percentage >= 95) {
        showNotification({
            message: `⚠️ ¡Casi en el límite! Te quedan solo ${remaining} cartas de ${max_cards}.`,
            type: NotificationType.WARNING,
            duration: 8000
        });
    } else if (usage_percentage >= 80) {
        showNotification({
            message: `⚠️ Estás usando el ${usage_percentage}% de tu límite. Te quedan ${remaining} cartas.`,
            type: NotificationType.WARNING,
            duration: 6000
        });
    }
}

/**
 * Show success notification
 *
 * @param {string} message - Success message
 * @param {number} [duration=3000] - Duration in milliseconds
 */
export function showSuccess(message, duration = 3000) {
    return showNotification({
        message,
        type: NotificationType.SUCCESS,
        duration
    });
}

/**
 * Show error notification
 *
 * @param {string} message - Error message
 * @param {number} [duration=5000] - Duration in milliseconds
 */
export function showError(message, duration = 5000) {
    return showNotification({
        message,
        type: NotificationType.ERROR,
        duration
    });
}

/**
 * Show info notification
 *
 * @param {string} message - Info message
 * @param {number} [duration=4000] - Duration in milliseconds
 */
export function showInfo(message, duration = 4000) {
    return showNotification({
        message,
        type: NotificationType.INFO,
        duration
    });
}

/**
 * Show warning notification
 *
 * @param {string} message - Warning message
 * @param {number} [duration=5000] - Duration in milliseconds
 */
export function showWarning(message, duration = 5000) {
    return showNotification({
        message,
        type: NotificationType.WARNING,
        duration
    });
}
