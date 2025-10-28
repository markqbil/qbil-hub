const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    logger.info('Created upload directory', { path: uploadDir });
}

// File signature validation (magic numbers)
const FILE_SIGNATURES = {
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]], // DOCX (ZIP)
    'application/msword': [[0xD0, 0xCF, 0x11, 0xE0]], // DOC
    'text/plain': null, // No specific signature for text files
    'text/csv': null
};

/**
 * Validate file signature (magic numbers) to prevent MIME type spoofing
 */
const validateFileSignature = (buffer, mimeType) => {
    const signatures = FILE_SIGNATURES[mimeType];
    
    // Skip validation for text files (no reliable signature)
    if (!signatures) {
        return true;
    }

    // Check if buffer matches any of the allowed signatures
    return signatures.some(signature => {
        return signature.every((byte, index) => buffer[index] === byte);
    });
};

// Get allowed MIME types from environment or use defaults
const getAllowedMimeTypes = () => {
    if (process.env.ALLOWED_FILE_TYPES) {
        return process.env.ALLOWED_FILE_TYPES.split(',').map(t => t.trim());
    }
    
    return [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/csv'
    ];
};

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure no path traversal
        const safePath = path.normalize(uploadDir).replace(/^(\.\.(\/|\\|$))+/, '');
        cb(null, safePath);
    },
    filename: (req, file, cb) => {
        // Generate cryptographically secure unique filename
        const timestamp = Date.now();
        const randomBytes = crypto.randomBytes(16).toString('hex');
        const extension = path.extname(file.originalname).toLowerCase();
        const basename = path.basename(file.originalname, extension);
        
        // Strict filename sanitization: only alphanumeric and underscore
        const sanitizedBasename = basename
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 50); // Limit length
        
        const secureFilename = `${sanitizedBasename}_${timestamp}_${randomBytes}${extension}`;
        cb(null, secureFilename);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = getAllowedMimeTypes();

    // Check MIME type
    if (!allowedTypes.includes(file.mimetype)) {
        logger.warn('File upload rejected: invalid MIME type', { 
            mimetype: file.mimetype,
            filename: file.originalname 
        });
        return cb(new Error(`File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`), false);
    }

    // Check file extension
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.csv'];
    
    if (!allowedExtensions.includes(extension)) {
        logger.warn('File upload rejected: invalid extension', { 
            extension,
            filename: file.originalname 
        });
        return cb(new Error(`File extension ${extension} not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`), false);
    }

    // Prevent null bytes in filename (path traversal attack)
    if (file.originalname.includes('\0')) {
        logger.warn('File upload rejected: null byte in filename', { 
            filename: file.originalname 
        });
        return cb(new Error('Invalid filename'), false);
    }

    cb(null, true);
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
    }
});

class FileService {
    static getUploadMiddleware() {
        return upload.single('document');
    }

    static getUploadMultipleMiddleware() {
        return upload.array('documents', 5); // Max 5 files
    }

    /**
     * Comprehensive file validation
     */
    static validateFile(file) {
        const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;

        // Size validation
        if (file.size > maxSize) {
            throw new Error(`File size exceeds limit of ${maxSize / (1024 * 1024)}MB`);
        }

        // Zero-byte file check
        if (file.size === 0) {
            throw new Error('File is empty');
        }

        // Extension validation
        const extension = path.extname(file.originalname).toLowerCase();
        const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.csv'];

        if (!allowedExtensions.includes(extension)) {
            throw new Error(`File type ${extension} not allowed`);
        }

        // Filename validation (no special characters)
        const filename = path.basename(file.originalname);
        if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
            throw new Error('Filename contains invalid characters');
        }

        return true;
    }

    /**
     * Validate file signature (magic numbers)
     * This should be called after the file is uploaded
     */
    static async validateFileSignature(filePath, expectedMimeType) {
        return new Promise((resolve, reject) => {
            const stream = fs.createReadStream(filePath, { start: 0, end: 3 });
            const chunks = [];

            stream.on('data', chunk => chunks.push(chunk));
            stream.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const isValid = validateFileSignature(buffer, expectedMimeType);
                
                if (!isValid) {
                    logger.warn('File signature validation failed', { 
                        filePath, 
                        expectedMimeType 
                    });
                    reject(new Error('File content does not match declared type'));
                } else {
                    resolve(true);
                }
            });
            stream.on('error', reject);
        });
    }

    static async deleteFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
        } catch (error) {
            console.error('Error deleting file:', error);
        }
        return false;
    }

    static getFileInfo(filePath) {
        try {
            const stats = fs.statSync(filePath);
            const extension = path.extname(filePath).toLowerCase();

            return {
                path: filePath,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                extension: extension,
                exists: true
            };
        } catch (error) {
            return {
                path: filePath,
                exists: false,
                error: error.message
            };
        }
    }

    static generateSecureFilename(originalName) {
        const extension = path.extname(originalName);
        const timestamp = Date.now();
        const random = crypto.randomBytes(8).toString('hex');
        return `${timestamp}-${random}${extension}`;
    }

    static async processDocument(filePath) {
        // This is a placeholder for document processing
        // In a real implementation, this would extract text/data from the document
        const fileInfo = this.getFileInfo(filePath);

        return {
            fileInfo,
            extractedData: {},
            processingStatus: 'completed'
        };
    }
}

module.exports = FileService;













