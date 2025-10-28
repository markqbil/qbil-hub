const express = require('express');
const AuditController = require('../controllers/auditController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { companyRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(requireAdmin);

// Apply company rate limiting
router.use(companyRateLimiter());

// Get company audit logs
router.get('/logs', AuditController.getCompanyAuditLogs);

// Get audit logs for specific resource
router.get('/logs/:resource_type/:resource_id', AuditController.getResourceAuditLogs);

// Get audit statistics
router.get('/stats', AuditController.getAuditStats);

module.exports = router;

