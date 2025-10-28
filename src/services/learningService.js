const ProductMapping = require('../models/ProductMapping');
const { query } = require('../utils/database');
const natural = require('natural');

class LearningService {
    static async trainMappings(fromCompanyId, toCompanyId) {
        // Get all existing mappings for training
        const mappings = await ProductMapping.findByCompanies(fromCompanyId, toCompanyId);

        if (mappings.length < 2) {
            return { message: 'Not enough data for training', mappings_count: mappings.length };
        }

        // Extract features from existing mappings
        const trainingData = mappings.map(mapping => ({
            input: this.extractFeatures(mapping.from_product_code),
            output: mapping.to_product_code,
            confidence: mapping.confidence_score
        }));

        // Train a simple model (placeholder for more sophisticated ML)
        const model = this.createSimpleModel(trainingData);

        // Store model for later use (in a real implementation, this would be more sophisticated)
        await this.saveModel(fromCompanyId, toCompanyId, model);

        return {
            message: 'Model trained successfully',
            training_samples: trainingData.length,
            model_accuracy: this.calculateModelAccuracy(trainingData, model)
        };
    }

    static extractFeatures(productCode) {
        // Extract features from product code for machine learning
        const normalized = productCode.toLowerCase().trim();

        return {
            length: normalized.length,
            word_count: normalized.split(/\s+/).length,
            has_numbers: /\d/.test(normalized),
            has_special_chars: /[^a-zA-Z0-9\s]/.test(normalized),
            first_word: normalized.split(/\s+/)[0] || '',
            last_word: normalized.split(/\s+/).pop() || '',
            alphanumeric_ratio: this.calculateAlphanumericRatio(normalized)
        };
    }

    static calculateAlphanumericRatio(text) {
        const alphanumeric = text.replace(/[^a-zA-Z0-9]/g, '');
        return alphanumeric.length / Math.max(text.length, 1);
    }

    static createSimpleModel(trainingData) {
        // Simple rule-based model based on common patterns
        const patterns = {};

        trainingData.forEach(data => {
            const inputWords = data.input.first_word;
            if (!patterns[inputWords]) {
                patterns[inputWords] = [];
            }
            patterns[inputWords].push({
                output: data.output,
                confidence: data.confidence
            });
        });

        return {
            type: 'pattern_based',
            patterns: patterns,
            created_at: new Date().toISOString()
        };
    }

    static async saveModel(fromCompanyId, toCompanyId, model) {
        // In a real implementation, this would save to a file or database
        const modelKey = `${fromCompanyId}_${toCompanyId}`;

        // For now, just log that model was saved
        console.log(`Model saved for companies ${fromCompanyId} -> ${toCompanyId}`);
    }

    static calculateModelAccuracy(trainingData, model) {
        // Simple accuracy calculation
        let correct = 0;

        trainingData.forEach(data => {
            const prediction = this.predictMapping(model, data.input);
            if (prediction && prediction.output === data.output) {
                correct++;
            }
        });

        return trainingData.length > 0 ? correct / trainingData.length : 0;
    }

    static predictMapping(model, features) {
        if (model.type === 'pattern_based') {
            const patterns = model.patterns[features.first_word];
            if (patterns && patterns.length > 0) {
                // Return the most confident prediction
                patterns.sort((a, b) => b.confidence - a.confidence);
                return {
                    output: patterns[0].output,
                    confidence: patterns[0].confidence
                };
            }
        }

        return null;
    }

    static async suggestProductMapping(fromCompanyId, toCompanyId, fromProductCode) {
        try {
            // First try to find exact or similar existing mapping
            const exactMatch = await ProductMapping.findBestMatch(fromCompanyId, toCompanyId, fromProductCode);

            if (exactMatch && exactMatch.confidence_score > 0.8) {
                return {
                    suggestion: exactMatch.to_product_code,
                    confidence: exactMatch.confidence_score,
                    method: 'exact_match',
                    mapping_id: exactMatch.id
                };
            }

            // Try pattern-based prediction
            const features = this.extractFeatures(fromProductCode);
            const model = await this.loadModel(fromCompanyId, toCompanyId);

            if (model) {
                const prediction = this.predictMapping(model, features);
                if (prediction && prediction.confidence > 0.5) {
                    return {
                        suggestion: prediction.output,
                        confidence: prediction.confidence,
                        method: 'pattern_based'
                    };
                }
            }

            // Try similarity-based suggestion
            const similarMappings = await ProductMapping.findSimilarMappings(
                fromCompanyId,
                toCompanyId,
                fromProductCode,
                3
            );

            if (similarMappings.length > 0) {
                // Calculate similarities and return best match
                const similarities = similarMappings.map(mapping => ({
                    ...mapping,
                    calculated_similarity: ProductMapping.calculateSimilarity(fromProductCode, mapping.from_product_code)
                }));

                similarities.sort((a, b) => b.calculated_similarity - a.calculated_similarity);

                return {
                    suggestion: similarities[0].to_product_code,
                    confidence: similarities[0].calculated_similarity,
                    method: 'similarity_based',
                    based_on: similarities[0].from_product_code
                };
            }

            // No suggestion available
            return {
                suggestion: null,
                confidence: 0,
                method: 'none'
            };

        } catch (error) {
            console.error('Error suggesting product mapping:', error);
            return {
                suggestion: null,
                confidence: 0,
                method: 'error',
                error: error.message
            };
        }
    }

    static async loadModel(fromCompanyId, toCompanyId) {
        // In a real implementation, this would load a trained model from storage
        // For now, return null to indicate no model is available
        return null;
    }

    static async updateMappingWithFeedback(mappingId, userFeedback) {
        // Update mapping confidence based on user feedback
        const { accepted, confidence_adjustment } = userFeedback;

        try {
            const mapping = await ProductMapping.findById(mappingId);

            if (!mapping) {
                throw new Error('Mapping not found');
            }

            let newConfidence = mapping.confidence_score;

            if (accepted) {
                // Increase confidence
                newConfidence = Math.min(1.0, newConfidence + (confidence_adjustment || 0.1));
            } else {
                // Decrease confidence
                newConfidence = Math.max(0.0, newConfidence - (confidence_adjustment || 0.1));
            }

            await ProductMapping.updateConfidence(mappingId, newConfidence);

            // Trigger retraining if confidence changed significantly
            if (Math.abs(mapping.confidence_score - newConfidence) > 0.2) {
                // Schedule retraining (in a real implementation)
                console.log('Significant confidence change detected, retraining recommended');
            }

            return { success: true, new_confidence: newConfidence };

        } catch (error) {
            console.error('Error updating mapping with feedback:', error);
            return { success: false, error: error.message };
        }
    }

    static async getLearningStats(fromCompanyId, toCompanyId) {
        const mappings = await ProductMapping.findByCompanies(fromCompanyId, toCompanyId);
        const stats = await ProductMapping.getMappingStats(fromCompanyId, toCompanyId);

        // Calculate additional learning metrics
        const highConfidenceMappings = mappings.filter(m => m.confidence_score > 0.8).length;
        const mediumConfidenceMappings = mappings.filter(m => m.confidence_score > 0.5 && m.confidence_score <= 0.8).length;
        const lowConfidenceMappings = mappings.filter(m => m.confidence_score <= 0.5).length;

        const totalUsage = mappings.reduce((sum, m) => sum + m.usage_count, 0);

        return {
            ...stats,
            confidence_distribution: {
                high: highConfidenceMappings,
                medium: mediumConfidenceMappings,
                low: lowConfidenceMappings
            },
            average_usage_per_mapping: mappings.length > 0 ? totalUsage / mappings.length : 0,
            learning_progress: this.calculateLearningProgress(mappings)
        };
    }

    static calculateLearningProgress(mappings) {
        if (mappings.length === 0) return 0;

        // Calculate progress based on confidence and usage
        const avgConfidence = mappings.reduce((sum, m) => sum + m.confidence_score, 0) / mappings.length;
        const avgUsage = mappings.reduce((sum, m) => sum + m.usage_count, 0) / mappings.length;

        // Normalize to 0-1 scale
        const confidenceScore = Math.min(1, avgConfidence);
        const usageScore = Math.min(1, avgUsage / 10); // Assume 10 usages is "good"

        return (confidenceScore + usageScore) / 2;
    }

    static async getMappingSuggestions(fromCompanyId, toCompanyId, limit = 10) {
        // Get mappings that could benefit from manual review
        const result = await query(
            `SELECT * FROM product_mappings
             WHERE from_company_id = ? AND to_company_id = ?
             AND confidence_score < 0.8
             ORDER BY usage_count DESC, confidence_score ASC
             LIMIT ?`,
            [fromCompanyId, toCompanyId, limit]
        );

        return result.rows.map(mapping => ({
            id: mapping.id,
            from_product_code: mapping.from_product_code,
            to_product_code: mapping.to_product_code,
            confidence_score: mapping.confidence_score,
            usage_count: mapping.usage_count,
            needs_review: mapping.confidence_score < 0.7
        }));
    }
}

module.exports = LearningService;








