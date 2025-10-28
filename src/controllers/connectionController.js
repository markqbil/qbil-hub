const Connection = require('../models/Connection');
const Company = require('../models/Company');
const AuditLogger = require('../utils/auditLogger');

class ConnectionController {
    static async searchCompanies(req, res) {
        try {
            const { search } = req.query;
            const user = req.user;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            let companies;

            if (search && search.trim()) {
                companies = await Company.search(search.trim());
            } else {
                companies = await Company.findAll();
            }

            // Filter out the user's own company
            companies = companies.filter(company => company.id !== user.company_id);

            res.json({
                companies: companies.map(company => ({
                    id: company.id,
                    name: company.name,
                    business_id: company.business_id,
                    email_domain: company.email_domain
                }))
            });

        } catch (error) {
            console.error('Search companies error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async requestConnection(req, res) {
        try {
            const { target_company_id } = req.body;
            const user = req.user;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            if (!target_company_id) {
                return res.status(400).json({ error: 'Target company ID is required' });
            }

            // Get target company
            const targetCompany = await Company.findById(target_company_id);
            if (!targetCompany) {
                return res.status(404).json({ error: 'Target company not found' });
            }

            // Get user's company
            const userCompany = await Company.findById(user.company_id);

            // Check if connection can be initiated
            const canInitiate = await Connection.canInitiateConnection(user.company_id, target_company_id);
            if (!canInitiate.canInitiate) {
                return res.status(400).json({ error: canInitiate.reason });
            }

            // Check if user is trying to connect to their own company
            if (user.company_id === target_company_id) {
                return res.status(400).json({ error: 'Cannot connect to your own company' });
            }

            // Create connection request
            const connection = await Connection.create({
                initiator_company_id: user.company_id,
                target_company_id: target_company_id,
                initiated_by: user.id
            });

            // Audit log
            await AuditLogger.logConnection(req, 'requested', connection.id, {
                target_company: targetCompany.name,
                target_business_id: targetCompany.business_id
            });

            res.status(201).json({
                message: 'Connection request sent successfully',
                connection: {
                    id: connection.id,
                    target_company: {
                        id: targetCompany.id,
                        name: targetCompany.name,
                        business_id: targetCompany.business_id
                    },
                    status: connection.status,
                    created_at: connection.created_at
                }
            });

        } catch (error) {
            console.error('Request connection error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getPendingRequests(req, res) {
        try {
            const user = req.user;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const pendingRequests = await Connection.getPendingRequests(user.company_id);

            res.json({
                pending_requests: pendingRequests.map(request => ({
                    id: request.id,
                    initiator_company: {
                        id: request.initiator_company_id,
                        name: request.initiator_company_name,
                        business_id: request.initiator_business_id
                    },
                    initiated_by: {
                        first_name: request.initiated_by_first_name,
                        last_name: request.initiated_by_last_name
                    },
                    created_at: request.created_at
                }))
            });

        } catch (error) {
            console.error('Get pending requests error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async approveConnection(req, res) {
        try {
            const { connection_id } = req.params;
            const user = req.user;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const connection = await Connection.findById(connection_id);
            if (!connection) {
                return res.status(404).json({ error: 'Connection request not found' });
            }

            if (connection.target_company_id !== user.company_id) {
                return res.status(403).json({ error: 'Can only approve connections to your company' });
            }

            if (connection.status !== 'pending') {
                return res.status(400).json({ error: 'Connection request is not pending' });
            }

            const approvedConnection = await Connection.approve(connection_id, user.id);

            // Audit log
            await AuditLogger.logConnection(req, 'approved', connection_id, {
                initiator_company_id: connection.initiator_company_id
            });

            res.json({
                message: 'Connection approved successfully',
                connection: {
                    id: approvedConnection.id,
                    status: approvedConnection.status,
                    approved_at: approvedConnection.approved_at
                }
            });

        } catch (error) {
            console.error('Approve connection error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async declineConnection(req, res) {
        try {
            const { connection_id } = req.params;
            const user = req.user;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const connection = await Connection.findById(connection_id);
            if (!connection) {
                return res.status(404).json({ error: 'Connection request not found' });
            }

            if (connection.target_company_id !== user.company_id) {
                return res.status(403).json({ error: 'Can only decline connections to your company' });
            }

            if (connection.status !== 'pending') {
                return res.status(400).json({ error: 'Connection request is not pending' });
            }

            const declinedConnection = await Connection.decline(connection_id);

            // Audit log
            await AuditLogger.logConnection(req, 'declined', connection_id, {
                initiator_company_id: connection.initiator_company_id
            });

            res.json({
                message: 'Connection declined',
                connection: {
                    id: declinedConnection.id,
                    status: declinedConnection.status
                }
            });

        } catch (error) {
            console.error('Decline connection error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getMyConnections(req, res) {
        try {
            const user = req.user;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const connections = await Connection.getCompanyConnections(user.company_id);

            res.json({
                connections: connections.map(connection => ({
                    id: connection.id,
                    initiator_company: {
                        id: connection.initiator_company_id,
                        name: connection.initiator_company_name
                    },
                    target_company: {
                        id: connection.target_company_id,
                        name: connection.target_company_name
                    },
                    status: connection.status,
                    initiated_by: connection.initiated_by ? {
                        first_name: connection.initiated_by_first_name,
                        last_name: connection.initiated_by_last_name
                    } : null,
                    approved_by: connection.approved_by ? {
                        first_name: connection.approved_by_first_name,
                        last_name: connection.approved_by_last_name
                    } : null,
                    created_at: connection.created_at,
                    approved_at: connection.approved_at,
                    suspended_at: connection.suspended_at
                }))
            });

        } catch (error) {
            console.error('Get connections error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async suspendConnection(req, res) {
        try {
            const { connection_id } = req.params;
            const user = req.user;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const connection = await Connection.findById(connection_id);
            if (!connection) {
                return res.status(404).json({ error: 'Connection not found' });
            }

            // Check if user is part of this connection
            if (connection.initiator_company_id !== user.company_id &&
                connection.target_company_id !== user.company_id) {
                return res.status(403).json({ error: 'Can only manage connections involving your company' });
            }

            if (connection.status !== 'approved') {
                return res.status(400).json({ error: 'Can only suspend approved connections' });
            }

            const suspendedConnection = await Connection.suspend(connection_id);

            res.json({
                message: 'Connection suspended successfully',
                connection: {
                    id: suspendedConnection.id,
                    status: suspendedConnection.status,
                    suspended_at: suspendedConnection.suspended_at
                }
            });

        } catch (error) {
            console.error('Suspend connection error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getConnectionStats(req, res) {
        try {
            const user = req.user;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const { query } = require('../utils/database');

            // Get connection counts by status
            const statusStats = await query(
                `SELECT status, COUNT(*) as count
                 FROM connections
                 WHERE initiator_company_id = ? OR target_company_id = ?
                 GROUP BY status`,
                [user.company_id, user.company_id]
            );

            // Get recent connections
            const recentConnections = await query(
                `SELECT 
                    c.status,
                    c.created_at,
                    CASE 
                        WHEN c.initiator_company_id = ? THEN 'initiated'
                        ELSE 'received'
                    END as direction
                 FROM connections c
                 WHERE c.initiator_company_id = ? OR c.target_company_id = ?
                 AND c.created_at > datetime('now', '-30 days')
                 ORDER BY c.created_at DESC`,
                [user.company_id, user.company_id, user.company_id]
            );

            // Get document exchange stats per connection
            const documentStats = await query(
                `SELECT 
                    c.id as connection_id,
                    CASE 
                        WHEN c.initiator_company_id = ? THEN tc.name
                        ELSE ic.name
                    END as partner_company,
                    COUNT(DISTINCT d.id) as document_count,
                    MAX(d.sent_at) as last_document_date
                 FROM connections c
                 LEFT JOIN companies ic ON c.initiator_company_id = ic.id
                 LEFT JOIN companies tc ON c.target_company_id = tc.id
                 LEFT JOIN documents d ON c.id = d.connection_id
                 WHERE (c.initiator_company_id = ? OR c.target_company_id = ?)
                 AND c.status = 'approved'
                 GROUP BY c.id
                 ORDER BY document_count DESC
                 LIMIT 10`,
                [user.company_id, user.company_id, user.company_id]
            );

            res.json({
                stats: {
                    by_status: statusStats.rows.reduce((acc, row) => {
                        acc[row.status] = parseInt(row.count);
                        return acc;
                    }, {}),
                    recent_activity: recentConnections.rows,
                    top_partners: documentStats.rows.map(row => ({
                        partner_company: row.partner_company,
                        document_count: parseInt(row.document_count),
                        last_document_date: row.last_document_date
                    }))
                }
            });

        } catch (error) {
            console.error('Get connection stats error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = ConnectionController;




