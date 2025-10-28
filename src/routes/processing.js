const express = require('express');
const ProcessingController = require('../controllers/processingController');
const { authenticate } = require('../middleware/auth');
const { userRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Apply user rate limiting
router.use(userRateLimiter());

// Basic validation middleware for required params
router.param('document_id', (req, res, next, val) => {
    if (!/^[0-9]+$/.test(String(val))) {
        return res.status(400).json({ error: 'Invalid document_id' });
    }
    next();
});

// Get document for processing
router.get('/document/:document_id', ProcessingController.getDocumentForProcessing);

// Process a document (apply mappings, create records)
router.post('/document/:document_id/process', ProcessingController.processDocument);

// Get processing queue
router.get('/queue', ProcessingController.getProcessingQueue);

module.exports = router;








