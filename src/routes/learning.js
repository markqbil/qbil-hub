const express = require('express');
const LearningController = require('../controllers/learningController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { companyRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(requireAdmin);

// Apply company rate limiting
router.use(companyRateLimiter());

// Train mappings for a company pair
router.post('/train', LearningController.trainMappings);

// Get mapping suggestion for a product code
router.get('/suggest', LearningController.suggestMapping);

// Get learning statistics
router.get('/stats', LearningController.getLearningStats);

// Get mapping suggestions that need review
router.get('/suggestions', LearningController.getMappingSuggestions);

// Update mapping with user feedback
router.post('/mapping/:mapping_id/feedback', (req, res, next) => {
    if (!/^[0-9]+$/.test(String(req.params.mapping_id))) {
        return res.status(400).json({ error: 'Invalid mapping_id' });
    }
    next();
}, LearningController.updateMappingFeedback);

// Get all mappings for management
router.get('/mappings', LearningController.getAllMappings);

module.exports = router;








