const Document = require('../models/Document');
const Connection = require('../models/Connection');
const Company = require('../models/Company');
const FileService = require('../services/fileService');
const DocumentProcessor = require('../services/documentProcessor');
const AuditLogger = require('../utils/auditLogger');

class DocumentController {
    static async sendDocument(req, res) {
        try {
            const user = req.user;
            const {
                recipient_company_id,
                document_type,
                priority = 'normal',
                recipient_user_ids,
                use_hub = true
            } = req.body;

            // Validate required fields
            if (!recipient_company_id || !req.file) {
                return res.status(400).json({
                    error: 'recipient_company_id and document file are required'
                });
            }

            // Auto-detect document type if not provided
            let finalDocumentType = document_type;
            if (!finalDocumentType) {
                finalDocumentType = DocumentProcessor.detectDocumentTypeFromExtension(req.file.path);
            }

            // Validate file
            FileService.validateFile(req.file);

            // Check if Hub connection exists (if use_hub is true)
            if (use_hub) {
                const connection = await Connection.findByCompanies(
                    user.company_id,
                    recipient_company_id
                );

                if (!connection || connection.status !== 'approved') {
                    return res.status(400).json({
                        error: 'No approved Hub connection exists with the recipient company'
                    });
                }
            }

            // Get recipient company
            const recipientCompany = await Company.findById(recipient_company_id);
            if (!recipientCompany) {
                return res.status(404).json({ error: 'Recipient company not found' });
            }

            // Validate recipient user IDs if provided
            if (recipient_user_ids && recipient_user_ids.length > 0) {
                const recipientUsers = await Company.getUsers(recipient_company_id);
                const validUserIds = recipientUsers.map(u => u.id);

                for (const userId of recipient_user_ids) {
                    if (!validUserIds.includes(userId)) {
                        return res.status(400).json({
                            error: `Invalid recipient user ID: ${userId}`
                        });
                    }
                }
            }

            // Create document record
            const document = await Document.create({
                sender_company_id: user.company_id,
                recipient_company_id: recipient_company_id,
                connection_id: use_hub ? await Connection.findByCompanies(user.company_id, recipient_company_id).then(c => c?.id) : null,
                document_type: finalDocumentType,
                original_filename: req.file.originalname,
                file_path: req.file.path,
                file_size: req.file.size,
                mime_type: req.file.mimetype,
                priority: priority,
                created_by: user.id,
                recipient_user_ids: recipient_user_ids || []
            });

            // Audit log
            await AuditLogger.logDocument(req, 'sent', document.id, {
                document_type: finalDocumentType,
                recipient_company: recipientCompany.name,
                file_size: req.file.size,
                priority
            });

            // Process document asynchronously (extract content, etc.)
            setImmediate(async () => {
                try {
                    await DocumentController.processDocumentAsync(document.id, req.file.path);
                } catch (error) {
                    console.error('Async document processing error:', error);
                }
            });

            res.status(201).json({
                message: 'Document sent successfully',
                document: {
                    id: document.id,
                    document_type: finalDocumentType,
                    original_filename: document.original_filename,
                    file_size: document.file_size,
                    priority: document.priority,
                    status: document.status,
                    recipient_count: recipient_user_ids ? recipient_user_ids.length : 0,
                    sent_at: document.sent_at
                }
            });

        } catch (error) {
            console.error('Send document error:', error);

            // Clean up uploaded file if there was an error
            if (req.file && req.file.path) {
                FileService.deleteFile(req.file.path);
            }

            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async processDocumentAsync(documentId, filePath) {
        try {
            // Mark document as delivered
            await Document.markAsDelivered(documentId);

            // Get document details for processing
            const document = await Document.findById(documentId);

            if (!document) {
                throw new Error('Document not found');
            }

            // Extract text from document
            const extractedText = await DocumentProcessor.extractText(filePath);

            // Analyze document structure
            const structure = DocumentProcessor.analyzeDocumentStructure(extractedText);

            // Detect document type if not specified
            let detectedType = document.document_type;
            if (!detectedType) {
                detectedType = DocumentProcessor.detectDocumentType(extractedText);
            }

            // Extract business data based on document type
            const extractedData = DocumentProcessor.extractBusinessData(extractedText, detectedType);

            // Calculate confidence score
            const confidence = DocumentProcessor.calculateConfidence(extractedData);

            // Store extracted data
            for (const [fieldName, fieldValue] of Object.entries(extractedData)) {
                await Document.addDocumentContent(documentId, fieldName, fieldValue, confidence);
            }

            // Store document structure info
            await Document.addDocumentContent(documentId, 'document_structure', JSON.stringify(structure), 0.9);
            await Document.addDocumentContent(documentId, 'extracted_text', extractedText.substring(0, 5000), 1.0); // First 5000 chars

            // Mark as processed
            await Document.markAsProcessed(documentId);

            console.log(`Document ${documentId} processed successfully with confidence ${confidence}`);

        } catch (error) {
            console.error('Document processing error:', error);
        }
    }

    static async getSentDocuments(req, res) {
        try {
            const user = req.user;
            const { limit = 50, offset = 0 } = req.query;

            const documents = await Document.getSentByCompany(
                user.company_id,
                parseInt(limit),
                parseInt(offset)
            );

            res.json({
                documents: documents.map(doc => ({
                    id: doc.id,
                    document_type: doc.document_type,
                    original_filename: doc.original_filename,
                    file_size: doc.file_size,
                    mime_type: doc.mime_type,
                    priority: doc.priority,
                    status: doc.status,
                    recipient_company_name: doc.recipient_company_name,
                    recipient_count: parseInt(doc.recipient_count),
                    sent_at: doc.sent_at,
                    delivered_at: doc.delivered_at,
                    processed_at: doc.processed_at
                })),
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    count: documents.length
                }
            });

        } catch (error) {
            console.error('Get sent documents error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getReceivedDocuments(req, res) {
        try {
            const user = req.user;
            const { limit = 50, offset = 0, status, document_type, priority } = req.query;

            const filters = { limit: parseInt(limit), offset: parseInt(offset) };
            if (status) filters.status = status;
            if (document_type) filters.document_type = document_type;
            if (priority) filters.priority = priority;

            const documents = await Document.getUserInbox(user.id, filters);

            res.json({
                documents: documents.map(doc => ({
                    id: doc.id,
                    document_type: doc.document_type,
                    original_filename: doc.original_filename,
                    file_size: doc.file_size,
                    priority: doc.priority,
                    status: doc.status,
                    sender_company_name: doc.sender_company_name,
                    is_acknowledged: doc.is_acknowledged,
                    acknowledged_at: doc.acknowledged_at,
                    sent_at: doc.sent_at,
                    delivered_at: doc.delivered_at
                })),
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    count: documents.length
                }
            });

        } catch (error) {
            console.error('Get received documents error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getDocument(req, res) {
        try {
            const { document_id } = req.params;
            const user = req.user;

            const document = await Document.findById(document_id);

            if (!document) {
                return res.status(404).json({ error: 'Document not found' });
            }

            // Check if user has access to this document
            const isSender = document.sender_company_id === user.company_id;
            const isRecipient = document.recipient_company_id === user.company_id;

            if (!isSender && !isRecipient) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Get recipients
            const recipients = await Document.getDocumentRecipients(document_id);

            // Get document content
            const content = await Document.getDocumentContent(document_id);

            res.json({
                document: {
                    id: document.id,
                    document_type: document.document_type,
                    original_filename: document.original_filename,
                    file_path: document.file_path,
                    file_size: document.file_size,
                    mime_type: document.mime_type,
                    priority: document.priority,
                    status: document.status,
                    sender_company_name: document.sender_company_name,
                    recipient_company_name: document.recipient_company_name,
                    sent_at: document.sent_at,
                    delivered_at: document.delivered_at,
                    processed_at: document.processed_at,
                    recipients: recipients.map(r => ({
                        id: r.id,
                        first_name: r.first_name,
                        last_name: r.last_name,
                        email: r.email,
                        is_acknowledged: r.is_acknowledged,
                        acknowledged_at: r.acknowledged_at
                    })),
                    content: content.map(c => ({
                        field_name: c.field_name,
                        field_value: c.field_value,
                        confidence_score: c.confidence_score,
                        is_verified: c.is_verified
                    }))
                }
            });

        } catch (error) {
            console.error('Get document error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async acknowledgeDocument(req, res) {
        try {
            const { document_id } = req.params;
            const user = req.user;

            const document = await Document.findById(document_id);

            if (!document) {
                return res.status(404).json({ error: 'Document not found' });
            }

            // Check if user is a recipient
            const recipients = await Document.getDocumentRecipients(document_id);
            const isRecipient = recipients.some(r => r.recipient_user_id === user.id);

            if (!isRecipient) {
                return res.status(403).json({ error: 'You are not a recipient of this document' });
            }

            await Document.acknowledgeDocument(document_id, user.id);

            // Audit log
            await AuditLogger.logDocument(req, 'acknowledged', document_id, {
                sender_company_id: document.sender_company_id
            });

            res.json({
                message: 'Document acknowledged successfully'
            });

        } catch (error) {
            console.error('Acknowledge document error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getDocumentStats(req, res) {
        try {
            const user = req.user;

            const stats = await Document.getDocumentStats(user.company_id);

            res.json({
                stats: {
                    sent: parseInt(stats.sent_count) || 0,
                    received: parseInt(stats.received_count) || 0,
                    delivered: parseInt(stats.delivered_count) || 0,
                    processed: parseInt(stats.processed_count) || 0
                }
            });

        } catch (error) {
            console.error('Get document stats error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async downloadDocument(req, res) {
        try {
            const { document_id } = req.params;
            const user = req.user;
            const fs = require('fs');
            const path = require('path');

            const document = await Document.findById(document_id);

            if (!document) {
                return res.status(404).json({ error: 'Document not found' });
            }

            // Check if user has access to this document
            const isSender = document.sender_company_id === user.company_id;
            const isRecipient = document.recipient_company_id === user.company_id;

            if (!isSender && !isRecipient) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // If recipient, check if user is in recipients list
            if (isRecipient) {
                const recipients = await Document.getDocumentRecipients(document_id);
                const isInRecipients = recipients.some(r => r.recipient_user_id === user.id);
                
                if (!isInRecipients && recipients.length > 0) {
                    return res.status(403).json({ error: 'You are not authorized to download this document' });
                }
            }

            // Check if file exists
            if (!document.file_path || !fs.existsSync(document.file_path)) {
                return res.status(404).json({ error: 'Document file not found' });
            }

            // Audit log
            await AuditLogger.logDocument(req, 'downloaded', document_id, {
                filename: document.original_filename
            });

            // Set appropriate headers for download
            const filename = document.original_filename || path.basename(document.file_path);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', document.mime_type || 'application/octet-stream');

            // Stream the file
            const fileStream = fs.createReadStream(document.file_path);
            fileStream.pipe(res);

            fileStream.on('error', (error) => {
                console.error('File stream error:', error);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Error downloading file' });
                }
            });

        } catch (error) {
            console.error('Download document error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = DocumentController;
