const { query, transaction } = require('../utils/database');

class Connection {
    static async findById(id) {
        const result = await query(
            'SELECT * FROM connections WHERE id = ?',
            [id]
        );
        return result.rows[0];
    }

    static async findByCompanies(initiatorCompanyId, targetCompanyId) {
        const result = await query(
            `SELECT * FROM connections
             WHERE initiator_company_id = ? AND target_company_id = ?`,
            [initiatorCompanyId, targetCompanyId]
        );
        return result.rows[0];
    }

    static async getCompanyConnections(companyId) {
        const result = await query(
            `SELECT c.*,
                    ic.name as initiator_company_name,
                    tc.name as target_company_name,
                    ib.first_name as initiated_by_first_name,
                    ib.last_name as initiated_by_last_name,
                    ab.first_name as approved_by_first_name,
                    ab.last_name as approved_by_last_name
             FROM connections c
             JOIN companies ic ON c.initiator_company_id = ic.id
             JOIN companies tc ON c.target_company_id = tc.id
             LEFT JOIN users ib ON c.initiated_by = ib.id
             LEFT JOIN users ab ON c.approved_by = ab.id
             WHERE c.initiator_company_id = ? OR c.target_company_id = ?
             ORDER BY c.created_at DESC`,
            [companyId, companyId]
        );
        return result.rows;
    }

    static async create(connectionData) {
        const { initiator_company_id, target_company_id, initiated_by } = connectionData;

        const result = await query(
            `INSERT INTO connections (initiator_company_id, target_company_id, initiated_by)
             VALUES (?, ?, ?)
             RETURNING *`,
            [initiator_company_id, target_company_id, initiated_by]
        );

        return result.rows[0];
    }

    static async approve(connectionId, approvedBy) {
        const result = await query(
            `UPDATE connections
             SET status = 'approved', approved_by = ?, approved_at = CURRENT_TIMESTAMP
             WHERE id = ? AND status = 'pending'
             RETURNING *`,
            [approvedBy, connectionId]
        );

        return result.rows[0];
    }

    static async decline(connectionId) {
        const result = await query(
            `UPDATE connections
             SET status = 'declined'
             WHERE id = ? AND status = 'pending'
             RETURNING *`,
            [connectionId]
        );

        return result.rows[0];
    }

    static async suspend(connectionId, suspendedBy) {
        const result = await query(
            `UPDATE connections
             SET status = 'suspended', suspended_at = CURRENT_TIMESTAMP
             WHERE id = ? AND status = 'approved'
             RETURNING *`,
            [connectionId]
        );

        return result.rows[0];
    }

    static async getPendingRequests(companyId) {
        const result = await query(
            `SELECT c.*,
                    ic.name as initiator_company_name,
                    ic.business_id as initiator_business_id,
                    ib.first_name as initiated_by_first_name,
                    ib.last_name as initiated_by_last_name
             FROM connections c
             JOIN companies ic ON c.initiator_company_id = ic.id
             LEFT JOIN users ib ON c.initiated_by = ib.id
             WHERE c.target_company_id = ? AND c.status = 'pending'
             ORDER BY c.created_at DESC`,
            [companyId]
        );
        return result.rows;
    }

    static async canInitiateConnection(fromCompanyId, toCompanyId) {
        // Check if there's already a connection between these companies
        const existing = await this.findByCompanies(fromCompanyId, toCompanyId);
        if (existing) {
            return { canInitiate: false, reason: 'Connection already exists' };
        }

        // Check if there's a reverse connection
        const reverse = await this.findByCompanies(toCompanyId, fromCompanyId);
        if (reverse) {
            return { canInitiate: false, reason: 'Reverse connection already exists' };
        }

        return { canInitiate: true };
    }
}

module.exports = Connection;




