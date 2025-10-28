const { query, transaction } = require('../utils/database');
const natural = require('natural');

class ProductMapping {
    static async findById(id) {
        const result = await query(
            'SELECT * FROM product_mappings WHERE id = ?',
            [id]
        );
        return result.rows[0];
    }

    static async findByCompanies(fromCompanyId, toCompanyId) {
        const result = await query(
            `SELECT * FROM product_mappings
             WHERE from_company_id = ? AND to_company_id = ?
             ORDER BY confidence_score DESC, usage_count DESC`,
            [fromCompanyId, toCompanyId]
        );
        return result.rows;
    }

    static async findBestMatch(fromCompanyId, toCompanyId, fromProductCode) {
        const result = await query(
            `SELECT * FROM product_mappings
             WHERE from_company_id = ? AND to_company_id = ?
             AND from_product_code LIKE ? COLLATE NOCASE
             ORDER BY confidence_score DESC, usage_count DESC
             LIMIT 1`,
            [fromCompanyId, toCompanyId, `%${fromProductCode}%`]
        );

        return result.rows[0];
    }

    static async createOrUpdate(mappingData) {
        const { from_company_id, to_company_id, from_product_code, to_product_code, confidence_score, created_by } = mappingData;

        const result = await transaction(async (client) => {
            // Check if mapping already exists
            const existing = await client.query(
                `SELECT * FROM product_mappings
                 WHERE from_company_id = ? AND to_company_id = ? AND from_product_code = ?`,
                [from_company_id, to_company_id, from_product_code]
            );

            if (existing.rows[0]) {
                // Update existing mapping
                const updated = await client.query(
                    `UPDATE product_mappings
                     SET to_product_code = ?, confidence_score = ?, usage_count = usage_count + 1,
                         last_used = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?
                     RETURNING *`,
                    [to_product_code, confidence_score, existing.rows[0].id]
                );
                return updated.rows[0];
            } else {
                // Create new mapping
                const created = await client.query(
                    `INSERT INTO product_mappings
                     (from_company_id, to_company_id, from_product_code, to_product_code,
                      confidence_score, created_by)
                     VALUES (?, ?, ?, ?, ?, ?)
                     RETURNING *`,
                    [from_company_id, to_company_id, from_product_code, to_product_code,
                     confidence_score, created_by]
                );
                return created.rows[0];
            }
        });

        return result;
    }

    static async findSimilarMappings(fromCompanyId, toCompanyId, searchTerm, limit = 10) {
        const result = await query(
            `SELECT *
             FROM product_mappings
             WHERE from_company_id = ? AND to_company_id = ?
             AND (from_product_code LIKE ? COLLATE NOCASE OR to_product_code LIKE ? COLLATE NOCASE)
             ORDER BY confidence_score DESC, usage_count DESC
             LIMIT ?`,
            [fromCompanyId, toCompanyId, `%${searchTerm}%`, `%${searchTerm}%`, limit]
        );

        return result.rows;
    }

    static async getMappingStats(fromCompanyId, toCompanyId) {
        const result = await query(
            `SELECT
                COUNT(*) as total_mappings,
                AVG(confidence_score) as avg_confidence,
                SUM(usage_count) as total_usage,
                SUM(CASE WHEN is_manual = 1 THEN 1 ELSE 0 END) as manual_mappings,
                SUM(CASE WHEN is_manual = 0 THEN 1 ELSE 0 END) as auto_mappings
             FROM product_mappings
             WHERE from_company_id = ? AND to_company_id = ?`,
            [fromCompanyId, toCompanyId]
        );

        return result.rows[0];
    }

    static async updateConfidence(id, newConfidence, userId) {
        const result = await query(
            `UPDATE product_mappings
             SET confidence_score = ?, usage_count = usage_count + 1, last_used = CURRENT_TIMESTAMP
             WHERE id = ?
             RETURNING *`,
            [newConfidence, id]
        );

        return result.rows[0];
    }

    static async deleteMapping(id) {
        const result = await query(
            'DELETE FROM product_mappings WHERE id = ? RETURNING *',
            [id]
        );
        return result.rows[0];
    }

    static calculateSimilarity(text1, text2) {
        // Simple similarity calculation using natural language processing
        const tokenizer = new natural.WordTokenizer();
        const words1 = tokenizer.tokenize(text1.toLowerCase()) || [];
        const words2 = tokenizer.tokenize(text2.toLowerCase()) || [];

        if (words1.length === 0 || words2.length === 0) {
            return 0;
        }

        // Calculate Jaccard similarity
        const set1 = new Set(words1);
        const set2 = new Set(words2);
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    static async suggestMapping(fromCompanyId, toCompanyId, fromProductCode) {
        // Find existing mappings with similar product codes
        const similar = await this.findSimilarMappings(fromCompanyId, toCompanyId, fromProductCode, 5);

        if (similar.length === 0) {
            return null;
        }

        // Calculate similarities
        const suggestions = similar.map(mapping => ({
            ...mapping,
            calculated_similarity: this.calculateSimilarity(fromProductCode, mapping.from_product_code)
        }));

        // Return the best suggestion
        suggestions.sort((a, b) => b.calculated_similarity - a.calculated_similarity);

        const sim = suggestions[0].calculated_similarity || 0;
        const conf = suggestions[0].confidence_score || 0;
        const avg = (sim + conf) / 2;
        const clamped = Math.max(0, Math.min(1, avg));
        return {
            suggestion: suggestions[0].to_product_code,
            confidence: clamped,
            based_on: suggestions[0].from_product_code
        };
    }
}

module.exports = ProductMapping;







