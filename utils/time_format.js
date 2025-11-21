/**
 * Formats a duration in seconds into a human-readable string (X天X小时X分钟X秒).
 * @param {number} totalSeconds - The total duration in seconds.
 * @returns {string} The formatted duration string.
 */
function formatDuration(totalSeconds) {
    if (totalSeconds <= 0) {
        return '0秒';
    }

    const days = Math.floor(totalSeconds / 86400);
    totalSeconds %= 86400;
    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);

    let result = '';
    if (days > 0) result += `${days}天`;
    if (hours > 0) result += `${hours}小时`;
    if (minutes > 0) result += `${minutes}分钟`;
    if (seconds > 0 || result === '') result += `${seconds}秒`;

    return result;
}

module.exports = {
    formatDuration,
};