const bcrypt = require('bcryptjs');
const { query, close } = require('../utils/database');
const logger = require('../utils/logger');

async function seed() {
    try {
        logger.info('Starting database seeding...');

        // Create demo companies
        const companies = [
            { name: 'Trading Company A', business_id: 'TCA001', email_domain: 'companya.com' },
            { name: 'Trading Company B', business_id: 'TCB002', email_domain: 'companyb.com' },
            { name: 'Trading Company C', business_id: 'TCC003', email_domain: 'companyc.com' }
        ];

        const createdCompanies = [];

        for (const company of companies) {
            try {
                // Check if company already exists
                const existing = await query(
                    'SELECT id FROM companies WHERE business_id = ?',
                    [company.business_id]
                );

                if (existing.rows.length > 0) {
                    logger.debug(`Company ${company.name} already exists, skipping`);
                    createdCompanies.push(existing.rows[0]);
                    continue;
                }

                // Create company
                const result = await query(
                    'INSERT INTO companies (name, business_id, email_domain) VALUES (?, ?, ?) RETURNING id',
                    [company.name, company.business_id, company.email_domain]
                );

                createdCompanies.push(result.rows[0]);
                logger.info(`Created company: ${company.name}`);
            } catch (error) {
                logger.error(`Failed to create company ${company.name}`, { error: error.message });
            }
        }

        console.log(`\n✅ Created ${createdCompanies.length} companies`);

        // Create demo users with password "admin123"
        const password_hash = await bcrypt.hash('admin123', 10);

        const users = [
            {
                company_id: createdCompanies[0].id,
                email: 'admin@companya.com',
                first_name: 'Admin',
                last_name: 'User A',
                is_admin: true
            },
            {
                company_id: createdCompanies[1].id,
                email: 'admin@companyb.com',
                first_name: 'Admin',
                last_name: 'User B',
                is_admin: true
            },
            {
                company_id: createdCompanies[2].id,
                email: 'admin@companyc.com',
                first_name: 'Admin',
                last_name: 'User C',
                is_admin: true
            },
            {
                company_id: createdCompanies[0].id,
                email: 'user@companya.com',
                first_name: 'Regular',
                last_name: 'User A',
                is_admin: false
            }
        ];

        let createdUsers = 0;

        for (const user of users) {
            try {
                // Check if user already exists
                const existing = await query(
                    'SELECT id FROM users WHERE email = ?',
                    [user.email]
                );

                if (existing.rows.length > 0) {
                    logger.debug(`User ${user.email} already exists, skipping`);
                    continue;
                }

                // Create user
                await query(
                    'INSERT INTO users (company_id, email, password_hash, first_name, last_name, is_admin) VALUES (?, ?, ?, ?, ?, ?)',
                    [user.company_id, user.email, password_hash, user.first_name, user.last_name, user.is_admin ? 1 : 0]
                );

                createdUsers++;
                logger.info(`Created user: ${user.email}`);
            } catch (error) {
                logger.error(`Failed to create user ${user.email}`, { error: error.message });
            }
        }

        console.log(`✅ Created ${createdUsers} users`);

        // Create demo connection (approved)
        try {
            const user1 = await query('SELECT id FROM users WHERE email = ?', ['admin@companya.com']);
            const user2 = await query('SELECT id FROM users WHERE email = ?', ['admin@companyb.com']);

            if (user1.rows.length > 0 && user2.rows.length > 0) {
                // Check if connection already exists
                const existingConn = await query(
                    'SELECT id FROM connections WHERE initiator_company_id = ? AND target_company_id = ?',
                    [createdCompanies[0].id, createdCompanies[1].id]
                );

                if (existingConn.rows.length === 0) {
                    await query(
                        `INSERT INTO connections 
                         (initiator_company_id, target_company_id, status, initiated_by, approved_by, approved_at) 
                         VALUES (?, ?, 'approved', ?, ?, CURRENT_TIMESTAMP)`,
                        [createdCompanies[0].id, createdCompanies[1].id, user1.rows[0].id, user2.rows[0].id]
                    );

                    logger.info('Created demo approved connection between Company A and Company B');
                    console.log('✅ Created demo connection');
                } else {
                    logger.debug('Demo connection already exists');
                }
            }
        } catch (error) {
            logger.error('Failed to create demo connection', { error: error.message });
        }

        // Create demo product mappings
        try {
            const mappings = [
                {
                    from_company_id: createdCompanies[0].id,
                    to_company_id: createdCompanies[1].id,
                    from_product_code: 'PROD-001',
                    to_product_code: 'ITEM-001',
                    confidence_score: 0.95
                },
                {
                    from_company_id: createdCompanies[0].id,
                    to_company_id: createdCompanies[1].id,
                    from_product_code: 'PROD-002',
                    to_product_code: 'ITEM-002',
                    confidence_score: 0.88
                }
            ];

            let createdMappings = 0;

            for (const mapping of mappings) {
                const existing = await query(
                    'SELECT id FROM product_mappings WHERE from_company_id = ? AND to_company_id = ? AND from_product_code = ?',
                    [mapping.from_company_id, mapping.to_company_id, mapping.from_product_code]
                );

                if (existing.rows.length === 0) {
                    await query(
                        `INSERT INTO product_mappings 
                         (from_company_id, to_company_id, from_product_code, to_product_code, confidence_score, usage_count) 
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [mapping.from_company_id, mapping.to_company_id, mapping.from_product_code, 
                         mapping.to_product_code, mapping.confidence_score, 0]
                    );
                    createdMappings++;
                }
            }

            if (createdMappings > 0) {
                logger.info(`Created ${createdMappings} demo product mappings`);
                console.log(`✅ Created ${createdMappings} product mappings`);
            }
        } catch (error) {
            logger.error('Failed to create demo product mappings', { error: error.message });
        }

        console.log('\n🎉 Database seeding completed successfully!');
        console.log('\n📋 Demo Credentials:');
        console.log('   Email:    admin@companya.com');
        console.log('   Password: admin123');
        console.log('   Role:     Admin\n');

        logger.info('Database seeding completed successfully');

    } catch (error) {
        logger.error('Seeding failed', { error: error.message, stack: error.stack });
        console.error('\n❌ Seeding failed:', error.message);
        process.exit(1);
    } finally {
        await close();
    }
}

// Run seeding if called directly
if (require.main === module) {
    seed();
}

module.exports = seed;