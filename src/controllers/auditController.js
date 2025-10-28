const AuditLogger = require('../utils/auditLogger');

class AuditController {
    /**
     * Get audit logs for the authenticated user's company
     */
    static async getCompanyAuditLogs(req, res) {
        try {
            const user = req.user;
            const { limit = 50, offset = 0, action, resource_type } = req.query;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            let logs = await AuditLogger.getCompanyAuditLogs(
                user.company_id,
                parseInt(limit),
                parseInt(offset)
            );

            // Filter by action if provided
            if (action) {
                logs = logs.filter(log => log.action === action);
            }

            // Filter by resource_type if provided
            if (resource_type) {
                logs = logs.filter(log => log.resource_type === resource_type);
            }

            res.json({
                logs,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    count: logs.length
                }
            });

        } catch (error) {
            console.error('Get audit logs error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get audit logs for a specific resource
     */
    static async getResourceAuditLogs(req, res) {
        try {
            const user = req.user;
            const { resource_type, resource_id } = req.params;
            const { limit = 20 } = req.query;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const logs = await AuditLogger.getResourceAuditLogs(
                resource_type,
                resource_id,
                parseInt(limit)
            );

            // Filter logs to only show those related to user's company
            const filteredLogs = logs.filter(log => log.company_id === user.company_id);

            res.json({
                logs: filteredLogs,
                resource_type,
                resource_id
            });

        } catch (error) {
            console.error('Get resource audit logs error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    /**
     * Get audit log statistics
     */
    static async getAuditStats(req, res) {
        try {
            const user = req.user;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const { query } = require('../utils/database');

            // Get counts by action type
            const actionStats = await query(
                `SELECT action, COUNT(*) as count
                 FROM audit_log
                 WHERE company_id = ?
                 AND created_at > datetime('now', '-30 days')
                 GROUP BY action
                 ORDER BY count DESC
                 LIMIT 10`,
                [user.company_id]
            );

            // Get daily activity for last 7 days
            const dailyActivity = await query(
                `SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as count
                 FROM audit_log
                 WHERE company_id = ?
                 AND created_at > datetime('now', '-7 days')
                 GROUP BY DATE(created_at)
                 ORDER BY date DESC`,
                [user.company_id]
            );

            // Get user activity
            const userActivity = await query(
                `SELECT 
                    u.email,
                    u.first_name,
                    u.last_name,
                    COUNT(*) as action_count
                 FROM audit_log al
                 JOIN users u ON al.user_id = u.id
                 WHERE al.company_id = ?
                 AND al.created_at > datetime('now', '-30 days')
                 GROUP BY u.id
                 ORDER BY action_count DESC
                 LIMIT 10`,
                [user.company_id]
            );

            res.json({
                stats: {
                    top_actions: actionStats.rows,
                    daily_activity: dailyActivity.rows,
                    user_activity: userActivity.rows
                },
                period: {
                    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                    end: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Get audit stats error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = AuditController;

