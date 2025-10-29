const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Store for user-based rate limiting
const userLimitStore = new Map();
const companyLimitStore = new Map();

if (process.env.NODE_ENV !== 'test') {
    // Clean up old entries every hour
    setInterval(() => {
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        for (const [key, value] of userLimitStore.entries()) {
            if (now - value.resetTime > oneHour) {
                userLimitStore.delete(key);
            }
        }

        for (const [key, value] of companyLimitStore.entries()) {
            if (now - value.resetTime > oneHour) {
                companyLimitStore.delete(key);
            }
        }
    }, 60 * 60 * 1000); // Run every hour
}

/**
 * User-based rate limiter middleware
 * Limits requests per authenticated user
 */
const userRateLimiter = (options = {}) => {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes
        max = 200, // 200 requests per window
        message = 'Too many requests from this user, please try again later.'
    } = options;

    return async (req, res, next) => {
        if (!req.user || !req.user.id) {
            // If no authenticated user, skip this limiter
            return next();
        }

        const userId = req.user.id;
        const now = Date.now();

        let userLimit = userLimitStore.get(userId);

        if (!userLimit || now > userLimit.resetTime) {
            // Initialize or reset
            userLimit = {
                count: 0,
                resetTime: now + windowMs
            };
            userLimitStore.set(userId, userLimit);
        }

        userLimit.count++;

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit-User', max);
        res.setHeader('X-RateLimit-Remaining-User', Math.max(0, max - userLimit.count));
        res.setHeader('X-RateLimit-Reset-User', new Date(userLimit.resetTime).toISOString());

        if (userLimit.count > max) {
            logger.warn('User rate limit exceeded', {
                userId,
                count: userLimit.count,
                max,
                ip: req.ip
            });

            return res.status(429).json({
                error: message,
                retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
            });
        }

        next();
    };
};

/**
 * Company-based rate limiter middleware
 * Limits requests per company (shared among all users)
 */
const companyRateLimiter = (options = {}) => {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes
        max = 500, // 500 requests per window per company
        message = 'Too many requests from your company, please try again later.'
    } = options;

    return async (req, res, next) => {
        if (!req.user || !req.user.company_id) {
            // If no authenticated user with company, skip this limiter
            return next();
        }

        const companyId = req.user.company_id;
        const now = Date.now();

        let companyLimit = companyLimitStore.get(companyId);

        if (!companyLimit || now > companyLimit.resetTime) {
            // Initialize or reset
            companyLimit = {
                count: 0,
                resetTime: now + windowMs
            };
            companyLimitStore.set(companyId, companyLimit);
        }

        companyLimit.count++;

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit-Company', max);
        res.setHeader('X-RateLimit-Remaining-Company', Math.max(0, max - companyLimit.count));
        res.setHeader('X-RateLimit-Reset-Company', new Date(companyLimit.resetTime).toISOString());

        if (companyLimit.count > max) {
            logger.warn('Company rate limit exceeded', {
                companyId,
                count: companyLimit.count,
                max,
                userId: req.user.id,
                ip: req.ip
            });

            return res.status(429).json({
                error: message,
                retryAfter: Math.ceil((companyLimit.resetTime - now) / 1000)
            });
        }

        next();
    };
};

/**
 * Strict rate limiter for sensitive endpoints (login, register)
 */
const strictRateLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5, // 5 attempts per window (higher in test)
    message: 'Too many attempts from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'test', // Skip in test environment
    handler: (req, res) => {
        logger.warn('Strict rate limit exceeded', {
            ip: req.ip,
            url: req.url,
            userAgent: req.get('user-agent')
        });

        res.status(429).json({
            error: 'Too many attempts from this IP, please try again later.',
            retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000)
        });
    }
});

/**
 * File upload rate limiter
 */
const uploadRateLimiter = (options = {}) => {
    const {
        windowMs = 60 * 60 * 1000, // 1 hour
        max = 50, // 50 uploads per hour per user
        message = 'Too many file uploads, please try again later.'
    } = options;

    return async (req, res, next) => {
        if (!req.user || !req.user.id) {
            return next();
        }

        const key = `upload_${req.user.id}`;
        const now = Date.now();

        let uploadLimit = userLimitStore.get(key);

        if (!uploadLimit || now > uploadLimit.resetTime) {
            uploadLimit = {
                count: 0,
                resetTime: now + windowMs
            };
            userLimitStore.set(key, uploadLimit);
        }

        uploadLimit.count++;

        res.setHeader('X-RateLimit-Limit-Upload', max);
        res.setHeader('X-RateLimit-Remaining-Upload', Math.max(0, max - uploadLimit.count));

        if (uploadLimit.count > max) {
            logger.warn('Upload rate limit exceeded', {
                userId: req.user.id,
                count: uploadLimit.count,
                max
            });

            return res.status(429).json({
                error: message,
                retryAfter: Math.ceil((uploadLimit.resetTime - now) / 1000)
            });
        }

        next();
    };
};

module.exports = {
    userRateLimiter,
    companyRateLimiter,
    strictRateLimiter,
    uploadRateLimiter
};

