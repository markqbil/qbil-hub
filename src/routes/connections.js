const express = require('express');
const ConnectionController = require('../controllers/connectionController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { companyRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(requireAdmin);

// Apply company rate limiting
router.use(companyRateLimiter());

// Search for companies to connect with
router.get('/search-companies', ConnectionController.searchCompanies);

// Request a new connection
router.post('/request', ConnectionController.requestConnection);

// Get pending connection requests for my company
router.get('/pending-requests', ConnectionController.getPendingRequests);

// Approve a connection request
router.post('/:connection_id/approve', ConnectionController.approveConnection);

// Decline a connection request
router.post('/:connection_id/decline', ConnectionController.declineConnection);

// Get all connections for my company
router.get('/my-connections', ConnectionController.getMyConnections);

// Suspend an active connection
router.post('/:connection_id/suspend', ConnectionController.suspendConnection);

// Get connection statistics
router.get('/stats', ConnectionController.getConnectionStats);

module.exports = router;













