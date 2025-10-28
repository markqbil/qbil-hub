const LearningService = require('../services/learningService');
const ProductMapping = require('../models/ProductMapping');

class LearningController {
    static async trainMappings(req, res) {
        try {
            const user = req.user;
            const { from_company_id, to_company_id } = req.body;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            // Use user's company if not specified
            const sourceCompanyId = from_company_id || user.company_id;
            const targetCompanyId = to_company_id;

            if (!targetCompanyId) {
                return res.status(400).json({ error: 'Target company ID is required' });
            }

            const result = await LearningService.trainMappings(sourceCompanyId, targetCompanyId);

            res.json({
                message: 'Training completed',
                result
            });

        } catch (error) {
            console.error('Train mappings error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async suggestMapping(req, res) {
        try {
            const { from_company_id, to_company_id, product_code } = req.query;

            if (!product_code) {
                return res.status(400).json({ error: 'Product code is required' });
            }

            const suggestion = await LearningService.suggestProductMapping(
                parseInt(from_company_id),
                parseInt(to_company_id),
                product_code
            );

            res.json({
                product_code: product_code,
                suggestion: suggestion
            });

        } catch (error) {
            console.error('Suggest mapping error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getLearningStats(req, res) {
        try {
            const user = req.user;
            const { company_id } = req.query;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const targetCompanyId = company_id || user.company_id;

            // Get stats for all connections or specific company
            const connections = await require('../models/Connection').getCompanyConnections(user.company_id);

            const statsPromises = connections
                .filter(conn => conn.status === 'approved')
                .map(async (conn) => {
                    const otherCompanyId = conn.initiator_company_id === user.company_id
                        ? conn.target_company_id
                        : conn.initiator_company_id;

                    return {
                        connection_id: conn.id,
                        company_name: conn.initiator_company_id === user.company_id
                            ? conn.target_company_name
                            : conn.initiator_company_name,
                        stats: await LearningService.getLearningStats(user.company_id, otherCompanyId)
                    };
                });

            const allStats = await Promise.all(statsPromises);

            res.json({
                learning_stats: allStats
            });

        } catch (error) {
            console.error('Get learning stats error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getMappingSuggestions(req, res) {
        try {
            const user = req.user;
            const { company_id, limit = 10 } = req.query;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const targetCompanyId = company_id || user.company_id;

            // Get connections for this company
            const connections = await require('../models/Connection').getCompanyConnections(user.company_id);

            const suggestionsPromises = connections
                .filter(conn => conn.status === 'approved')
                .map(async (conn) => {
                    const otherCompanyId = conn.initiator_company_id === user.company_id
                        ? conn.target_company_id
                        : conn.initiator_company_id;

                    const mappings = await LearningService.getMappingSuggestions(
                        user.company_id,
                        otherCompanyId,
                        parseInt(limit)
                    );

                    return {
                        connection_id: conn.id,
                        company_name: conn.initiator_company_id === user.company_id
                            ? conn.target_company_name
                            : conn.initiator_company_name,
                        suggestions: mappings
                    };
                });

            const allSuggestions = await Promise.all(suggestionsPromises);

            res.json({
                mapping_suggestions: allSuggestions
            });

        } catch (error) {
            console.error('Get mapping suggestions error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async updateMappingFeedback(req, res) {
        try {
            const { mapping_id } = req.params;
            const { accepted, confidence_adjustment } = req.body;
            const user = req.user;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const result = await LearningService.updateMappingWithFeedback(mapping_id, {
                accepted,
                confidence_adjustment
            });

            if (result.success) {
                res.json({
                    message: 'Feedback recorded successfully',
                    new_confidence: result.new_confidence
                });
            } else {
                res.status(400).json({ error: result.error });
            }

        } catch (error) {
            console.error('Update mapping feedback error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    static async getAllMappings(req, res) {
        try {
            const user = req.user;
            const { company_id, limit = 50, offset = 0 } = req.query;

            if (!user.is_admin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const targetCompanyId = company_id || user.company_id;

            // Get connections for this company
            const connections = await require('../models/Connection').getCompanyConnections(user.company_id);

            const mappingsPromises = connections
                .filter(conn => conn.status === 'approved')
                .map(async (conn) => {
                    const otherCompanyId = conn.initiator_company_id === user.company_id
                        ? conn.target_company_id
                        : conn.initiator_company_id;

                    const mappings = await ProductMapping.findByCompanies(
                        user.company_id,
                        otherCompanyId
                    );

                    return {
                        connection_id: conn.id,
                        company_name: conn.initiator_company_id === user.company_id
                            ? conn.target_company_name
                            : conn.initiator_company_name,
                        mappings: mappings.slice(parseInt(offset), parseInt(offset) + parseInt(limit))
                    };
                });

            const allMappings = await Promise.all(mappingsPromises);

            res.json({
                mappings: allMappings,
                pagination: {
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            });

        } catch (error) {
            console.error('Get all mappings error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = LearningController;
















