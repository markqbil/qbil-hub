const express = require('express');
const DocumentController = require('../controllers/documentController');
const FileService = require('../services/fileService');
const { authenticate } = require('../middleware/auth');
const { userRateLimiter, uploadRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Apply user rate limiting to all document routes
router.use(userRateLimiter());

// Send a document with upload rate limiting
router.post('/send', uploadRateLimiter(), FileService.getUploadMiddleware(), DocumentController.sendDocument);

// Multer/file upload error handler for this router
router.use((err, req, res, next) => {
    if (err && (err.code === 'LIMIT_FILE_SIZE' || err.message?.includes('File type'))) {
        return res.status(400).json({ error: err.message });
    }
    next(err);
});

// Get sent documents
router.get('/sent', DocumentController.getSentDocuments);

// Get received documents (Hub Inbox)
router.get('/received', DocumentController.getReceivedDocuments);

// Get specific document
router.get('/:document_id', DocumentController.getDocument);

// Acknowledge a received document
router.post('/:document_id/acknowledge', DocumentController.acknowledgeDocument);

// Get document statistics
router.get('/stats/overview', DocumentController.getDocumentStats);

// Download document
router.get('/:document_id/download', DocumentController.downloadDocument);

module.exports = router;








