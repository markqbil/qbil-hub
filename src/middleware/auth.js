const JWTUtils = require('../utils/jwt');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = JWTUtils.extractTokenFromHeader(authHeader);

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = JWTUtils.verifyToken(token);

        if (decoded.type !== 'access') {
            return res.status(401).json({ error: 'Invalid token type' });
        }

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Authentication failed: ' + error.message });
    }
};

const requireAdmin = (req, res, next) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

const requireSameCompany = (req, res, next) => {
    // This middleware can be used to ensure users can only access resources from their own company
    // Implementation depends on the specific route requirements
    next();
};

const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader) {
            const token = JWTUtils.extractTokenFromHeader(authHeader);
            const decoded = JWTUtils.verifyToken(token);

            if (decoded.type === 'access') {
                const user = await User.findById(decoded.id);
                if (user) {
                    req.user = user;
                }
            }
        }
        next();
    } catch (error) {
        // Ignore auth errors for optional authentication
        next();
    }
};

module.exports = {
    authenticate,
    requireAdmin,
    requireSameCompany,
    optionalAuth
};




