const logger = require('./logger');

/**
 * Simple in-memory cache with TTL support
 * Voor productie gebruik kan dit vervangen worden door Redis/Memcached
 */
class Cache {
    constructor() {
        this.cache = new Map();
        this.ttls = new Map();
        const isTestEnv = process.env.NODE_ENV === 'test';
        this.enabled = !isTestEnv && process.env.CACHE_ENABLED !== 'false'; // Disable in test env unless explicitly enabled
        this.defaultTTL = parseInt(process.env.CACHE_DEFAULT_TTL) || 300000; // 5 minuten
        
        // Cleanup expired entries elke minuut
        if (this.enabled) {
            this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
            logger.info('In-memory cache initialized', { 
                defaultTTL: this.defaultTTL,
                enabled: this.enabled 
            });
        }
    }

    /**
     * Get value from cache
     */
    get(key) {
        if (!this.enabled) return null;
        
        const ttl = this.ttls.get(key);
        
        // Check if expired
        if (ttl && Date.now() > ttl) {
            this.cache.delete(key);
            this.ttls.delete(key);
            logger.debug('Cache miss (expired)', { key });
            return null;
        }
        
        const value = this.cache.get(key);
        if (value !== undefined) {
            logger.debug('Cache hit', { key });
            return value;
        }
        
        logger.debug('Cache miss', { key });
        return null;
    }

    /**
     * Set value in cache with optional TTL
     */
    set(key, value, ttl = this.defaultTTL) {
        if (!this.enabled) return;
        
        this.cache.set(key, value);
        this.ttls.set(key, Date.now() + ttl);
        logger.debug('Cache set', { key, ttl });
    }

    /**
     * Delete value from cache
     */
    delete(key) {
        this.cache.delete(key);
        this.ttls.delete(key);
        logger.debug('Cache delete', { key });
    }

    /**
     * Delete all cache entries matching a pattern
     */
    deletePattern(pattern) {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
                this.ttls.delete(key);
                count++;
            }
        }
        logger.debug('Cache pattern delete', { pattern, count });
        return count;
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
        this.ttls.clear();
        logger.info('Cache cleared');
    }

    /**
     * Cleanup expired entries
     */
    cleanup() {
        const now = Date.now();
        let count = 0;
        
        for (const [key, ttl] of this.ttls.entries()) {
            if (now > ttl) {
                this.cache.delete(key);
                this.ttls.delete(key);
                count++;
            }
        }
        
        if (count > 0) {
            logger.debug('Cache cleanup', { expired: count, remaining: this.cache.size });
        }
    }

    /**
     * Get cache stats
     */
    getStats() {
        return {
            size: this.cache.size,
            enabled: this.enabled,
            defaultTTL: this.defaultTTL
        };
    }

    /**
     * Shutdown cache
     */
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
        logger.info('Cache shutdown');
    }
}

// Singleton instance
const cache = new Cache();

module.exports = cache;


