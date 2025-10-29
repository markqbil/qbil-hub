const Document = require('../models/Document');
const ProductMapping = require('../models/ProductMapping');

class ProcessingController {
    static async getDocumentForProcessing(req, res) {
        try {
            const { document_id } = req.params;
            const user = req.user;

            const document = await Document.findById(document_id);

            if (!document) {
                return res.status(404).json({ error: 'Document not found' });
            }

            // Check if user is a recipient and document is processed
            const recipients = await Document.getDocumentRecipients(document_id);
            const isRecipient = recipients.some(r => r.recipient_user_id === user.id);

            if (!isRecipient) {
                return res.status(403).json({ error: 'You are not a recipient of this document' });
            }

            if (document.status !== 'processed') {
                return res.status(400).json({ error: 'Document is not yet processed' });
            }

            // Get document content
            const content = await Document.getDocumentContent(document_id);

            // Get suggested mappings
            const suggestedMappings = await ProcessingController.getSuggestedMappings(
                document.sender_company_id,
                document.recipient_company_id,
                content
            );

            // Format content for processing interface
            const processedContent = content.map(item => ({
                field_name: item.field_name,
                field_value: item.field_value,
                confidence_score: item.confidence_score,
                is_verified: item.is_verified,
                suggested_mapping: suggestedMappings.find(m => m.field_name === item.field_name)?.suggested_value || null,
                mapping_confidence: suggestedMappings.find(m => m.field_name === item.field_name)?.confidence || 0
            }));

            res.json({
                document: {
                    id: document.id,
                    document_type: document.document_type,
                    original_filename: document.original_filename,
                    sender_company_name: document.sender_company_name,
                    status: document.status,
                    processed_at: document.processed_at,
                    content: processedContent,
                    processing_status: 'ready_for_review'
                }
            });

        } catch (error) {
            console.error('Get document for processing error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getSuggestedMappings(senderCompanyId, recipientCompanyId, documentContent) {
        const suggestions = [];

        for (const contentItem of documentContent) {
            if (contentItem.field_name === 'product_description' || contentItem.field_name === 'product_code') {
                // Get product mapping suggestions
                const mapping = await ProductMapping.findBestMatch(
                    senderCompanyId,
                    recipientCompanyId,
                    contentItem.field_value
                );

                if (mapping) {
                    suggestions.push({
                        field_name: contentItem.field_name,
                        original_value: contentItem.field_value,
                        suggested_value: mapping.to_product_code,
                        confidence: mapping.confidence_score,
                        mapping_id: mapping.id
                    });
                }
            }
        }

        return suggestions;
    }

    static async processDocument(req, res) {
        try {
            const { document_id } = req.params;
            const { mappings, create_records = false } = req.body;
            const user = req.user;

            const document = await Document.findById(document_id);

            if (!document) {
                return res.status(404).json({ error: 'Document not found' });
            }

            // Check permissions
            const recipients = await Document.getDocumentRecipients(document_id);
            const isRecipient = recipients.some(r => r.recipient_user_id === user.id);

            if (!isRecipient) {
                return res.status(403).json({ error: 'You are not authorized to process this document' });
            }

            // Apply mappings and create/update product mappings
            const results = [];

            for (const mapping of mappings) {
                const { field_name, original_value, mapped_value, confidence_score = 1.0 } = mapping;

                // Update document content with verified mapping
                await Document.addDocumentContent(document_id, field_name, mapped_value, confidence_score);

                // Create or update product mapping if this is a product field
                if (field_name === 'product_description' || field_name === 'product_code') {
                    const productMapping = await ProductMapping.createOrUpdate({
                        from_company_id: document.sender_company_id,
                        to_company_id: document.recipient_company_id,
                        from_product_code: original_value,
                        to_product_code: mapped_value,
                        confidence_score: confidence_score,
                        created_by: user.id
                    });

                    results.push({
                        field_name,
                        original_value,
                        mapped_value,
                        product_mapping_id: productMapping.id
                    });
                } else {
                    results.push({
                        field_name,
                        original_value,
                        mapped_value
                    });
                }
            }

            // If create_records is true, create corresponding records in recipient's system
            if (create_records) {
                // This would integrate with the recipient's ERP/accounting system
                // For now, just mark as completed
                console.log('Would create records for document:', document_id);
            }

            res.json({
                message: 'Document processed successfully',
                results,
                next_steps: create_records ? 'records_created' : 'ready_for_record_creation'
            });

        } catch (error) {
            console.error('Process document error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getProcessingQueue(req, res) {
        try {
            const user = req.user;
            const { status = 'processed', limit = 20, offset = 0 } = req.query;

            // Get documents that need processing
            const documents = await Document.getUserInbox(user.id, {
                status: status,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            // Filter to only include processed documents that haven't been fully processed yet
            const processingQueue = documents.filter(doc => doc.status === 'processed');

            res.json({
                processing_queue: processingQueue.map(doc => ({
                    id: doc.id,
                    document_type: doc.document_type,
                    original_filename: doc.original_filename,
                    sender_company_name: doc.sender_company_name,
                    status: doc.status,
                    processed_at: doc.processed_at,
                    is_acknowledged: doc.is_acknowledged,
                    priority: doc.priority
                })),
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    count: processingQueue.length
                }
            });

        } catch (error) {
            console.error('Get processing queue error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = ProcessingController;

















