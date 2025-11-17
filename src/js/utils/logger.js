/**
 * Professional logging system with configurable log levels
 * @module utils/logger
 */

/**
 * Log level enumeration
 * @readonly
 * @enum {number}
 */
const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

/**
 * Current log level - default to INFO in production
 * @type {number}
 */
let currentLevel = LogLevel.INFO;

/**
 * Logger object with methods for different log levels
 * @namespace
 */
export const logger = {
    /**
     * Set the current log level
     * @param {number} level - Log level from LogLevel enum
     */
    setLevel(level) {
        currentLevel = level;
    },

    /**
     * Log debug messages (only shown if level is DEBUG)
     * @param {...any} args - Arguments to log
     */
    debug(...args) {
        if (currentLevel <= LogLevel.DEBUG) {
            console.log('[DEBUG]', ...args);
        }
    },

    /**
     * Log info messages (shown if level is INFO or lower)
     * @param {...any} args - Arguments to log
     */
    info(...args) {
        if (currentLevel <= LogLevel.INFO) {
            console.info('[INFO]', ...args);
        }
    },

    /**
     * Log warning messages (shown if level is WARN or lower)
     * @param {...any} args - Arguments to log
     */
    warn(...args) {
        if (currentLevel <= LogLevel.WARN) {
            console.warn('[WARN]', ...args);
        }
    },

    /**
     * Log error messages (always shown unless level is above ERROR)
     * @param {...any} args - Arguments to log
     */
    error(...args) {
        if (currentLevel <= LogLevel.ERROR) {
            console.error('[ERROR]', ...args);
        }
    }
};

/**
 * Export LogLevel enum for external use
 */
export { LogLevel };
