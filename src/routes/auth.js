const express = require('express');
const AuthController = require('../controllers/authController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { strictRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Public routes with strict rate limiting
router.post('/login', strictRateLimiter, AuthController.login);
router.post('/register', strictRateLimiter, AuthController.register);
router.post('/refresh', strictRateLimiter, AuthController.refreshToken);

// Password reset routes (also rate limited)
router.post('/forgot-password', strictRateLimiter, AuthController.forgotPassword);
router.post('/reset-password', strictRateLimiter, AuthController.resetPassword);

// Protected routes
router.get('/me', authenticate, AuthController.me);

// Fallback for unsupported methods on /auth
router.all('*', (req, res) => {
    res.status(404).json({ error: 'Auth endpoint not found' });
});

module.exports = router;




