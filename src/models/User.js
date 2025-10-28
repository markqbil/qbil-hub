const { query } = require('../utils/database');
const bcrypt = require('bcryptjs');
const cache = require('../utils/cache');

/**
 * Normalize SQLite integers to booleans for specific fields
 */
const normalizeUser = (user) => {
    if (!user) return null;
    return {
        ...user,
        is_admin: Boolean(user.is_admin),
        is_active: Boolean(user.is_active)
    };
};

class User {
    static async findByEmail(email) {
        const cacheKey = `user:email:${email}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;
        
        const result = await query(
            'SELECT * FROM users WHERE email = ? AND is_active = 1',
            [email]
        );
        const user = normalizeUser(result.rows[0]);
        
        if (user) {
            cache.set(cacheKey, user, 600000); // 10 minuten
            cache.set(`user:id:${user.id}`, user, 600000); // Cache ook by ID
        }
        
        return user;
    }

    static async findById(id) {
        const cacheKey = `user:id:${id}`;
        const cached = cache.get(cacheKey);
        if (cached) return cached;
        
        const result = await query(
            'SELECT * FROM users WHERE id = ? AND is_active = 1',
            [id]
        );
        const user = normalizeUser(result.rows[0]);
        
        if (user) {
            cache.set(cacheKey, user, 600000); // 10 minuten
            cache.set(`user:email:${user.email}`, user, 600000); // Cache ook by email
        }
        
        return user;
    }

    static async create(userData) {
        const { company_id, email, password, first_name, last_name, is_admin = false } = userData;

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // SQLite supports RETURNING in modern versions; keep for now
        const result = await query(
            `INSERT INTO users (company_id, email, password_hash, first_name, last_name, is_admin)
             VALUES (?, ?, ?, ?, ?, ?)
             RETURNING id, company_id, email, first_name, last_name, is_admin, created_at`,
            [company_id, email, password_hash, first_name, last_name, is_admin ? 1 : 0]
        );

        const user = normalizeUser(result.rows[0]);
        
        // Invalidate company users cache
        cache.deletePattern(`company:${company_id}:users`);
        
        return user;
    }

    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    static async getCompanyUsers(companyId) {
        const result = await query(
            'SELECT id, email, first_name, last_name, is_admin FROM users WHERE company_id = ? AND is_active = 1',
            [companyId]
        );
        return result.rows.map(normalizeUser);
    }

    static async getAdminUsers(companyId) {
        const result = await query(
            'SELECT id, email, first_name, last_name FROM users WHERE company_id = ? AND is_admin = 1 AND is_active = 1',
            [companyId]
        );
        return result.rows.map(normalizeUser);
    }
}

module.exports = User;




