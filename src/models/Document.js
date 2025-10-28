const { query, transaction } = require('../utils/database');
const fs = require('fs').promises; // Use promises API for async operations
const fsSync = require('fs'); // Keep sync version for legacy compatibility
const path = require('path');

class Document {
    static async findById(id) {
        const result = await query(
            `SELECT d.*,
                    sc.name as sender_company_name,
                    rc.name as recipient_company_name,
                    ib.first_name as initiated_by_first_name,
                    ib.last_name as initiated_by_last_name
             FROM documents d
             JOIN companies sc ON d.sender_company_id = sc.id
             JOIN companies rc ON d.recipient_company_id = rc.id
             LEFT JOIN users ib ON d.created_by = ib.id
             WHERE d.id = ?`,
            [id]
        );
        return result.rows[0];
    }

    static async getByConnection(connectionId) {
        const result = await query(
            `SELECT d.*,
                    sc.name as sender_company_name,
                    rc.name as recipient_company_name
             FROM documents d
             JOIN companies sc ON d.sender_company_id = sc.id
             JOIN companies rc ON d.recipient_company_id = rc.id
             WHERE d.connection_id = ?
             ORDER BY d.created_at DESC`,
            [connectionId]
        );
        return result.rows;
    }

    static async getSentByCompany(companyId, limit = 50, offset = 0) {
        const result = await query(
            `SELECT d.*,
                    rc.name as recipient_company_name,
                    COUNT(dr.id) as recipient_count
             FROM documents d
             JOIN companies rc ON d.recipient_company_id = rc.id
             LEFT JOIN document_recipients dr ON d.id = dr.document_id
             WHERE d.sender_company_id = ?
             GROUP BY d.id, rc.name
             ORDER BY d.created_at DESC
             LIMIT ? OFFSET ?`,
            [companyId, limit, offset]
        );
        return result.rows;
    }

    static async getReceivedByCompany(companyId, limit = 50, offset = 0) {
        const result = await query(
            `SELECT d.*,
                    sc.name as sender_company_name,
                    COUNT(dr.id) as recipient_count
             FROM documents d
             JOIN companies sc ON d.sender_company_id = sc.id
             LEFT JOIN document_recipients dr ON d.id = dr.document_id
             WHERE d.recipient_company_id = ?
             GROUP BY d.id, sc.name
             ORDER BY d.created_at DESC
             LIMIT ? OFFSET ?`,
            [companyId, limit, offset]
        );
        return result.rows;
    }

    static async create(documentData) {
        const {
            sender_company_id,
            recipient_company_id,
            connection_id,
            document_type,
            original_filename,
            file_path,
            file_size,
            mime_type,
            priority = 'normal',
            created_by,
            recipient_user_ids = []
        } = documentData;

        const result = await transaction(async (client) => {
            // Create document record
            const docResult = await client.query(
                `INSERT INTO documents
                 (sender_company_id, recipient_company_id, connection_id, document_type,
                  original_filename, file_path, file_size, mime_type, priority, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 RETURNING *`,
                [sender_company_id, recipient_company_id, connection_id, document_type,
                 original_filename, file_path, file_size, mime_type, priority, created_by]
            );

            const document = docResult.rows[0];

            // Add recipients if provided
            if (recipient_user_ids.length > 0) {
                const placeholders = recipient_user_ids.map(() => '(?, ?)').join(', ');
                const recipientParams = [];
                for (const userId of recipient_user_ids) {
                    recipientParams.push(document.id, userId);
                }
                await client.query(
                    `INSERT INTO document_recipients (document_id, recipient_user_id)
                     VALUES ${placeholders}`,
                    recipientParams
                );
            }

            return document;
        });

        return result;
    }

    static async markAsDelivered(documentId) {
        const result = await query(
            `UPDATE documents
             SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP
             WHERE id = ? AND status = 'sent'
             RETURNING *`,
            [documentId]
        );
        return result.rows[0];
    }

    static async markAsProcessed(documentId) {
        const result = await query(
            `UPDATE documents
             SET status = 'processed', processed_at = CURRENT_TIMESTAMP
             WHERE id = ? AND status = 'delivered'
             RETURNING *`,
            [documentId]
        );
        return result.rows[0];
    }

    static async getDocumentRecipients(documentId) {
        const result = await query(
            `SELECT dr.*,
                    u.first_name, u.last_name, u.email
             FROM document_recipients dr
             JOIN users u ON dr.recipient_user_id = u.id
             WHERE dr.document_id = ?`,
            [documentId]
        );
        return result.rows;
    }

    static async getUserInbox(userId, filters = {}) {
        const { status, document_type, priority, limit = 50, offset = 0 } = filters;

        let whereConditions = ['dr.recipient_user_id = ?'];
        let params = [userId];
        let paramIndex = 2; // unused with '?', kept for readability

        if (status) {
            whereConditions.push(`d.status = ?`);
            params.push(status);
            paramIndex++;
        }

        if (document_type) {
            whereConditions.push(`d.document_type = ?`);
            params.push(document_type);
            paramIndex++;
        }

        if (priority) {
            whereConditions.push(`d.priority = ?`);
            params.push(priority);
            paramIndex++;
        }

        const whereClause = whereConditions.join(' AND ');

        const result = await query(
            `SELECT d.*,
                    sc.name as sender_company_name,
                    dr.is_acknowledged,
                    dr.acknowledged_at
             FROM documents d
             JOIN document_recipients dr ON d.id = dr.document_id
             JOIN companies sc ON d.sender_company_id = sc.id
             WHERE ${whereClause}
             ORDER BY d.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return result.rows;
    }

    static async acknowledgeDocument(documentId, userId) {
        const result = await query(
            `UPDATE document_recipients
             SET is_acknowledged = true, acknowledged_at = CURRENT_TIMESTAMP
             WHERE document_id = ? AND recipient_user_id = ?
             RETURNING *`,
            [documentId, userId]
        );
        return result.rows[0];
    }

    static async getDocumentContent(documentId) {
        const result = await query(
            'SELECT * FROM document_content WHERE document_id = ? ORDER BY field_name',
            [documentId]
        );
        return result.rows;
    }

    static async addDocumentContent(documentId, fieldName, fieldValue, confidenceScore = 1.0) {
        // Emulate upsert for SQLite without unique constraint on (document_id, field_name)
        // First try update; if no row updated, insert
        const update = await query(
            `UPDATE document_content
             SET field_value = ?, confidence_score = ?, updated_at = CURRENT_TIMESTAMP
             WHERE document_id = ? AND field_name = ?`,
            [fieldValue, confidenceScore, documentId, fieldName]
        );
        if (update.rowCount > 0) {
            const getRow = await query(
                `SELECT * FROM document_content WHERE document_id = ? AND field_name = ?`,
                [documentId, fieldName]
            );
            return getRow.rows[0];
        }
        const insert = await query(
            `INSERT INTO document_content (document_id, field_name, field_value, confidence_score)
             VALUES (?, ?, ?, ?)
             RETURNING *`,
            [documentId, fieldName, fieldValue, confidenceScore]
        );
        return insert.rows[0];
    }

    static async deleteFile(filePath) {
        try {
            // Use async file operations
            await fs.access(filePath);
            await fs.unlink(filePath);
            return true;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                const logger = require('../utils/logger');
                logger.error('Error deleting file', { filePath, error: error.message });
            }
        }
        return false;
    }

    static async deleteFiles(filePaths) {
        // Batch file deletion
        const results = await Promise.allSettled(
            filePaths.map(filePath => this.deleteFile(filePath))
        );
        return results.filter(r => r.status === 'fulfilled' && r.value).length;
    }

    static async getDocumentStats(companyId) {
        const result = await query(
            `SELECT
                SUM(CASE WHEN sender_company_id = ? THEN 1 ELSE 0 END) as sent_count,
                SUM(CASE WHEN recipient_company_id = ? THEN 1 ELSE 0 END) as received_count,
                SUM(CASE WHEN sender_company_id = ? AND status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
                SUM(CASE WHEN recipient_company_id = ? AND status = 'processed' THEN 1 ELSE 0 END) as processed_count
             FROM documents
             WHERE sender_company_id = ? OR recipient_company_id = ?`,
            [companyId, companyId, companyId, companyId, companyId, companyId]
        );
        return result.rows[0];
    }
}

module.exports = Document;







