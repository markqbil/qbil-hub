const { query } = require('./database');
const logger = require('./logger');

class AuditLogger {
    /**
     * Log an audit event to both Winston logger and database
     * @param {Object} params - Audit parameters
     * @param {string} params.userId - ID of user performing action
     * @param {string} params.companyId - ID of user's company
     * @param {string} params.action - Action being performed
     * @param {string} params.resourceType - Type of resource (connection, document, user)
     * @param {string} params.resourceId - ID of resource affected
     * @param {Object} params.details - Additional details (will be JSON stringified)
     * @param {string} params.ipAddress - IP address of request
     * @param {string} params.userAgent - User agent of request
     */
    static async log(params) {
        const {
            userId,
            companyId,
            action,
            resourceType,
            resourceId,
            details = {},
            ipAddress,
            userAgent
        } = params;

        try {
            // Log to Winston
            logger.logAudit(action, userId, companyId, {
                resourceType,
                resourceId,
                ...details
            });

            // Log to database for permanent record
            await query(
                `INSERT INTO audit_log 
                 (user_id, company_id, action, resource_type, resource_id, details, ip_address, user_agent)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    companyId,
                    action,
                    resourceType,
                    resourceId,
                    JSON.stringify(details),
                    ipAddress,
                    userAgent
                ]
            );
        } catch (error) {
            // Don't fail the request if audit logging fails
            logger.error('Failed to write audit log', {
                error: error.message,
                action,
                userId,
                companyId
            });
        }
    }

    /**
     * Helper to extract IP and User Agent from Express request
     */
    static getRequestMetadata(req) {
        return {
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent')
        };
    }

    /**
     * Log connection-related actions
     */
    static async logConnection(req, action, connectionId, details = {}) {
        const metadata = this.getRequestMetadata(req);
        await this.log({
            userId: req.user?.id,
            companyId: req.user?.company_id,
            action: `connection_${action}`,
            resourceType: 'connection',
            resourceId: connectionId,
            details,
            ...metadata
        });
    }

    /**
     * Log document-related actions
     */
    static async logDocument(req, action, documentId, details = {}) {
        const metadata = this.getRequestMetadata(req);
        await this.log({
            userId: req.user?.id,
            companyId: req.user?.company_id,
            action: `document_${action}`,
            resourceType: 'document',
            resourceId: documentId,
            details,
            ...metadata
        });
    }

    /**
     * Log user-related actions
     */
    static async logUser(req, action, targetUserId, details = {}) {
        const metadata = this.getRequestMetadata(req);
        await this.log({
            userId: req.user?.id,
            companyId: req.user?.company_id,
            action: `user_${action}`,
            resourceType: 'user',
            resourceId: targetUserId,
            details,
            ...metadata
        });
    }

    /**
     * Log authentication-related actions
     */
    static async logAuth(req, action, userId, details = {}) {
        const metadata = this.getRequestMetadata(req);
        await this.log({
            userId,
            companyId: details.companyId || null,
            action: `auth_${action}`,
            resourceType: 'user',
            resourceId: userId,
            details,
            ...metadata
        });
    }

    /**
     * Get recent audit logs for a company
     */
    static async getCompanyAuditLogs(companyId, limit = 50, offset = 0) {
        const result = await query(
            `SELECT al.*, u.email, u.first_name, u.last_name
             FROM audit_log al
             LEFT JOIN users u ON al.user_id = u.id
             WHERE al.company_id = ?
             ORDER BY al.created_at DESC
             LIMIT ? OFFSET ?`,
            [companyId, limit, offset]
        );

        return result.rows.map(row => ({
            ...row,
            details: row.details ? JSON.parse(row.details) : {}
        }));
    }

    /**
     * Get recent audit logs for a specific resource
     */
    static async getResourceAuditLogs(resourceType, resourceId, limit = 20) {
        const result = await query(
            `SELECT al.*, u.email, u.first_name, u.last_name
             FROM audit_log al
             LEFT JOIN users u ON al.user_id = u.id
             WHERE al.resource_type = ? AND al.resource_id = ?
             ORDER BY al.created_at DESC
             LIMIT ?`,
            [resourceType, resourceId, limit]
        );

        return result.rows.map(row => ({
            ...row,
            details: row.details ? JSON.parse(row.details) : {}
        }));
    }
}

module.exports = AuditLogger;

