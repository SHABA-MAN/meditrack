// Date utility functions for formatting and displaying dates

/**
 * Format ISO date string to Arabic localized date
 * @param {string} isoString - ISO date string
 * @returns {string} Formatted date string
 */
export const formatDate = (isoString) => {
    if (!isoString) return '';
    if (isoString === 'COMPLETED') return 'مكتمل';
    return new Date(isoString).toLocaleDateString('ar-EG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    });
};

/**
 * Format ISO date string to Arabic localized time
 * @param {string} isoString - ISO date string
 * @returns {string} Formatted time string
 */
export const formatTimeLog = (isoString) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} Today's date
 */
export const getTodayDateKey = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
};

/**
 * Get date key in YYYY-MM-DD format from date object
 * @param {Date} date - Date object
 * @returns {string} Date key
 */
export const getDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
