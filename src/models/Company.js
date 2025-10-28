const { query } = require('../utils/database');
const cache = require('../utils/cache');

class Company {
    static async findById(id) {
        const cacheKey = `company:id:${id}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;
        
        const result = await query(
            'SELECT * FROM companies WHERE id = ? AND is_active = 1',
            [id]
        );
        const company = result.rows[0];
        
        if (company) {
            cache.set(cacheKey, company, 600000); // 10 minuten
            cache.set(`company:business_id:${company.business_id}`, company, 600000);
        }
        
        return company;
    }

    static async findByBusinessId(businessId) {
        const cacheKey = `company:business_id:${businessId}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;
        
        const result = await query(
            'SELECT * FROM companies WHERE business_id = ? AND is_active = 1',
            [businessId]
        );
        const company = result.rows[0];
        
        if (company) {
            cache.set(cacheKey, company, 600000); // 10 minuten
            cache.set(`company:id:${company.id}`, company, 600000);
        }
        
        return company;
    }

    static async findAll() {
        const result = await query(
            'SELECT * FROM companies WHERE is_active = 1 ORDER BY name'
        );
        return result.rows;
    }

    static async search(searchTerm) {
        const result = await query(
            `SELECT * FROM companies
             WHERE is_active = 1
             AND (name LIKE ? COLLATE NOCASE OR business_id LIKE ? COLLATE NOCASE)
             ORDER BY name`,
            [`%${searchTerm}%`, `%${searchTerm}%`]
        );
        return result.rows;
    }

    static async create(companyData) {
        const { name, business_id, email_domain } = companyData;

        const result = await query(
            `INSERT INTO companies (name, business_id, email_domain)
             VALUES (?, ?, ?)
             RETURNING id, name, business_id, email_domain, created_at`,
            [name, business_id, email_domain]
        );

        const company = result.rows[0];
        
        // Invalidate companies list cache
        cache.deletePattern('companies:all');
        
        return company;
    }

    static async getUsers(companyId) {
        const result = await query(
            `SELECT id, email, first_name, last_name, is_admin
             FROM users
             WHERE company_id = ? AND is_active = 1
             ORDER BY first_name, last_name`,
            [companyId]
        );
        return result.rows;
    }
}

module.exports = Company;




