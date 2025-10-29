const User = require('../models/User');
const Company = require('../models/Company');
const JWTUtils = require('../utils/jwt');
const AuditLogger = require('../utils/auditLogger');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query } = require('../utils/database');

class AuthController {
    static async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }

            // Find user by email
            const user = await User.findByEmail(email);

            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Verify password
            const isValidPassword = await User.verifyPassword(password, user.password_hash);

            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Generate tokens
            const accessToken = JWTUtils.generateAccessToken(user);
            const refreshToken = JWTUtils.generateRefreshToken(user);

            // Get company data
            const company = await Company.findById(user.company_id);

            // Audit log
            await AuditLogger.logAuth(req, 'login', user.id, {
                companyId: user.company_id,
                email: user.email
            });

            // Remove password hash from response
            const userResponse = {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                is_admin: user.is_admin,
                company_id: user.company_id,
                company: company ? {
                    id: company.id,
                    name: company.name,
                    business_id: company.business_id
                } : null
            };

            res.json({
                user: userResponse,
                access_token: accessToken,
                refresh_token: refreshToken,
                token_type: 'Bearer',
                expires_in: 24 * 60 * 60 // 24 hours in seconds
            });

        } catch (error) {
            logger.error('Login error', { error: error.message, email: req.body.email });
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async register(req, res) {
        try {
            const { email, password, first_name, last_name, company_name, business_id, is_admin } = req.body;

            if (!email || !password || !first_name || !last_name || !company_name || !business_id) {
                return res.status(400).json({
                    error: 'All fields are required: email, password, first_name, last_name, company_name, business_id'
                });
            }

            // Check if company already exists
            let company = await Company.findByBusinessId(business_id);

            if (!company) {
                // Create new company
                company = await Company.create({
                    name: company_name,
                    business_id: business_id,
                    email_domain: email.split('@')[1] // Extract domain from email
                });
            }

            // Check if user already exists
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.status(409).json({ error: 'User already exists' });
            }

            // Create new user
            const user = await User.create({
                company_id: company.id,
                email,
                password,
                first_name,
                last_name,
                is_admin: is_admin || false
            });

            // Generate tokens
            const accessToken = JWTUtils.generateAccessToken(user);
            const refreshToken = JWTUtils.generateRefreshToken(user);

            // Audit log
            await AuditLogger.logAuth(req, 'register', user.id, {
                companyId: user.company_id,
                email: user.email,
                company_name: company_name
            });

            // Remove password hash from response
            const userResponse = {
                id: user.id,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                is_admin: user.is_admin,
                company_id: user.company_id,
                company: {
                    id: company.id,
                    name: company.name,
                    business_id: company.business_id
                }
            };

            res.status(201).json({
                user: userResponse,
                access_token: accessToken,
                refresh_token: refreshToken,
                token_type: 'Bearer',
                expires_in: 24 * 60 * 60
            });

        } catch (error) {
            logger.error('Registration error', { error: error.message, email: req.body.email });
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async refreshToken(req, res) {
        try {
            const { refresh_token } = req.body;

            if (!refresh_token) {
                return res.status(400).json({ error: 'Refresh token is required' });
            }

            // Verify refresh token
            const decoded = JWTUtils.verifyToken(refresh_token);

            if (decoded.type !== 'refresh') {
                return res.status(401).json({ error: 'Invalid token type' });
            }

            // Get user
            const user = await User.findById(decoded.id);

            if (!user) {
                return res.status(401).json({ error: 'User not found' });
            }

            // Generate new access token
            const accessToken = JWTUtils.generateAccessToken(user);

            res.json({
                access_token: accessToken,
                token_type: 'Bearer',
                expires_in: 24 * 60 * 60
            });

        } catch (error) {
            logger.error('Token refresh error', { error: error.message });
            res.status(401).json({ error: 'Invalid refresh token' });
        }
    }

    static async me(req, res) {
        try {
            const user = req.user;

            // Get user's company
            const company = await Company.findById(user.company_id);

            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    is_admin: user.is_admin,
                    company_id: user.company_id,
                    company: company ? {
                        id: company.id,
                        name: company.name,
                        business_id: company.business_id
                    } : null
                }
            });

        } catch (error) {
            logger.error('Get user info error', { error: error.message, userId: req.user?.id });
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async forgotPassword(req, res) {
        try {
            const { email } = req.body;

            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }

            // Find user by email
            const user = await User.findByEmail(email);

            if (!user) {
                // For security, don't reveal if user exists
                return res.json({
                    message: 'If the email exists, a password reset link has been sent'
                });
            }

            // Check if there's already a recent reset token
            const existingToken = await AuthController.getRecentResetToken(user.id);
            if (existingToken) {
                return res.json({
                    message: 'A password reset link has already been sent recently'
                });
            }

            // Generate secure reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            // Store reset token in database
            await AuthController.storeResetToken(user.id, resetToken, expiresAt, req);

            // Send reset email
            await emailService.sendPasswordResetEmail(user, resetToken);

            // Audit log
            await AuditLogger.logAuth(req, 'password_reset_requested', user.id, {
                email: user.email
            });

            res.json({
                message: 'If the email exists, a password reset link has been sent'
            });

        } catch (error) {
            logger.error('Forgot password error', { error: error.message, email: req.body.email });
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async resetPassword(req, res) {
        try {
            const { token, password } = req.body;

            if (!token || !password) {
                return res.status(400).json({ error: 'Token and password are required' });
            }

            if (password.length < 6) {
                return res.status(400).json({ error: 'Password must be at least 6 characters' });
            }

            // Find valid reset token
            const resetTokenData = await AuthController.getValidResetToken(token);

            if (!resetTokenData) {
                return res.status(400).json({ error: 'Invalid or expired reset token' });
            }

            // Update user password
            const saltRounds = 10;
            const password_hash = await bcrypt.hash(password, saltRounds);

            await query(
                'UPDATE users SET password_hash = ? WHERE id = ?',
                [password_hash, resetTokenData.user_id]
            );

            // Mark token as used
            await query(
                'UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?',
                [resetTokenData.id]
            );

            // Get user info for audit log
            const user = await User.findById(resetTokenData.user_id);

            // Audit log
            await AuditLogger.logAuth(req, 'password_reset_completed', user.id, {
                email: user.email
            });

            res.json({
                message: 'Password reset successfully'
            });

        } catch (error) {
            logger.error('Reset password error', { error: error.message, token: req.body.token });
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getRecentResetToken(userId) {
        const result = await query(
            `SELECT id FROM password_reset_tokens
             WHERE user_id = ? AND created_at > datetime('now', '-1 hour')
             ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );

        return result.rows[0];
    }

    static async storeResetToken(userId, token, expiresAt, req) {
        await query(
            `INSERT INTO password_reset_tokens
             (user_id, token, expires_at, ip_address, user_agent)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, token, expiresAt.toISOString(), req.ip, req.get('user-agent')]
        );
    }

    static async getValidResetToken(token) {
        const result = await query(
            `SELECT id, user_id FROM password_reset_tokens
             WHERE token = ? AND expires_at > datetime('now') AND used_at IS NULL`,
            [token]
        );

        return result.rows[0];
    }
}

module.exports = AuthController;




