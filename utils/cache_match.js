class CacheMatch {
    static generateCacheId() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    static formatCustomId(prefix, cacheId) {
        return `${prefix}:${cacheId}`;
    }

    static parseCustomId(customId) {
        const parts = customId.split(':');
        if (parts.length !== 2) return null;

        return {
            prefix: parts[0],
            cacheId: parts[1]
        };
    }

    static matchPrefix(customId, expectedPrefix) {
        const parsed = this.parseCustomId(customId);
        return parsed && parsed.prefix === expectedPrefix ? parsed.cacheId : null;
    }

    static isValidCacheId(cacheId) {
        return /^\d{4}$/.test(cacheId);
    }
}

module.exports = CacheMatch;