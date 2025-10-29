const crypto = require('crypto');

/**
 * ETag middleware voor caching support
 */
const etag = (req, res, next) => {
    const originalSend = res.send;

    res.send = function(data) {
        // Only generate ETags for successful GET requests with JSON data if headers not sent
        if (!res.headersSent && req.method === 'GET' && res.statusCode >= 200 && res.statusCode < 300) {
            if (typeof data === 'object' || typeof data === 'string') {
                const content = typeof data === 'object' ? JSON.stringify(data) : data;
                const hash = crypto.createHash('md5').update(content).digest('hex');
                const etagValue = `"${hash}"`;

                // Set ETag header
                res.setHeader('ETag', etagValue);

                // Check if client sent If-None-Match header
                const clientEtag = req.headers['if-none-match'];
                if (clientEtag === etagValue) {
                    res.status(304); // Not Modified
                    return originalSend.call(this, '');
                }
            }
        }

        return originalSend.call(this, data);
    };

    next();
};

/**
 * Pagination metadata helper
 */
const addPaginationMetadata = (res, data, total, limit, offset) => {
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);
    const hasNext = offset + limit < total;
    const hasPrev = offset > 0;

    res.setHeader('X-Total-Count', total);
    res.setHeader('X-Total-Pages', totalPages);
    res.setHeader('X-Current-Page', currentPage);
    res.setHeader('X-Per-Page', limit);
    
    // Link header voor HATEOAS
    const links = [];
    const baseUrl = `${req.protocol}://${req.get('host')}${req.path}`;
    
    if (hasPrev) {
        const prevOffset = Math.max(0, offset - limit);
        links.push(`<${baseUrl}?limit=${limit}&offset=${prevOffset}>; rel="prev"`);
        links.push(`<${baseUrl}?limit=${limit}&offset=0>; rel="first"`);
    }
    
    if (hasNext) {
        const nextOffset = offset + limit;
        links.push(`<${baseUrl}?limit=${limit}&offset=${nextOffset}>; rel="next"`);
        const lastOffset = (totalPages - 1) * limit;
        links.push(`<${baseUrl}?limit=${limit}&offset=${lastOffset}>; rel="last"`);
    }
    
    if (links.length > 0) {
        res.setHeader('Link', links.join(', '));
    }

    return {
        data,
        pagination: {
            total,
            limit,
            offset,
            currentPage,
            totalPages,
            hasNext,
            hasPrev
        }
    };
};

/**
 * Response time header
 */
const responseTime = (req, res, next) => {
    const start = Date.now();
    
    // Override res.send to set header before sending
    const originalSend = res.send;
    res.send = function(data) {
        const duration = Date.now() - start;
        // Only set header if not already set and headers not sent
        if (!res.headersSent) {
            res.setHeader('X-Response-Time', `${duration}ms`);
        }
        return originalSend.call(this, data);
    };
    
    next();
};

/**
 * Cache control headers
 */
const cacheControl = (maxAge = 300) => {
    return (req, res, next) => {
        if (req.method === 'GET') {
            res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
        } else {
            res.setHeader('Cache-Control', 'no-store');
        }
        next();
    };
};

module.exports = {
    etag,
    addPaginationMetadata,
    responseTime,
    cacheControl
};


