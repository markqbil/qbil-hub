const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

class JWTUtils {
    static generateToken(payload) {
        return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    }

    static verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    static generateAccessToken(user) {
        const payload = {
            id: user.id,
            email: user.email,
            company_id: user.company_id,
            is_admin: user.is_admin,
            type: 'access'
        };
        return this.generateToken(payload);
    }

    static generateRefreshToken(user) {
        const payload = {
            id: user.id,
            type: 'refresh'
        };
        return this.generateToken(payload);
    }

    static extractTokenFromHeader(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new Error('Authorization header must start with Bearer');
        }
        return authHeader.substring(7);
    }
}

module.exports = JWTUtils;




