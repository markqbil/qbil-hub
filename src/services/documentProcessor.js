const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const natural = require('natural');
const xlsx = require('xlsx');
const csv = require('csv-parser');

class DocumentProcessor {
    static async extractText(filePath) {
        const extension = path.extname(filePath).toLowerCase();

        try {
            switch (extension) {
                case '.pdf':
                    return await this.extractFromPDF(filePath);
                case '.docx':
                    return await this.extractFromDocx(filePath);
                case '.doc':
                    return await this.extractFromDoc(filePath);
                case '.txt':
                    return await this.extractFromText(filePath);
                case '.xlsx':
                case '.xls':
                    return await this.extractFromExcel(filePath);
                case '.csv':
                    return await this.extractFromCSV(filePath);
                default:
                    throw new Error(`Unsupported file type: ${extension}`);
            }
        } catch (error) {
            console.error('Text extraction error:', error);
            throw error;
        }
    }

    static async extractFromPDF(filePath) {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    }

    static async extractFromDocx(filePath) {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    }

    static async extractFromDoc(filePath) {
        // For older .doc files, we might need additional libraries
        // For now, return a placeholder
        throw new Error('DOC file processing not yet implemented');
    }

    static async extractFromText(filePath) {
        return fs.readFileSync(filePath, 'utf8');
    }

    static async extractFromExcel(filePath) {
        try {
            // Read Excel file
            const workbook = xlsx.readFile(filePath);

            let allText = '';
            let extractedData = {};

            // Process each worksheet
            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];

                // Convert to CSV format for easier parsing
                const csvData = xlsx.utils.sheet_to_csv(worksheet);
                allText += `Sheet: ${sheetName}\n${csvData}\n\n`;

                // Extract structured data
                const jsonData = xlsx.utils.sheet_to_json(worksheet, {
                    header: 1,
                    defval: ''
                });

                if (jsonData.length > 0) {
                    extractedData[sheetName] = this.extractStructuredData(jsonData);
                }
            });

            // Store structured data in text for processing
            if (Object.keys(extractedData).length > 0) {
                allText += '\n--- Structured Data ---\n';
                allText += JSON.stringify(extractedData, null, 2);
            }

            return allText;
        } catch (error) {
            console.error('Excel parsing error:', error);
            throw new Error(`Failed to parse Excel file: ${error.message}`);
        }
    }

    static async extractFromCSV(filePath) {
        try {
            return new Promise((resolve, reject) => {
                const results = [];
                let allText = '';

                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (data) => {
                        results.push(data);
                        allText += Object.values(data).join(',') + '\n';
                    })
                    .on('end', () => {
                        // Add structured data section
                        if (results.length > 0) {
                            allText += '\n--- Structured Data ---\n';
                            allText += JSON.stringify(this.extractStructuredData(results), null, 2);
                        }
                        resolve(allText);
                    })
                    .on('error', (error) => {
                        reject(new Error(`Failed to parse CSV file: ${error.message}`));
                    });
            });
        } catch (error) {
            console.error('CSV parsing error:', error);
            throw error;
        }
    }

    static extractStructuredData(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return {};
        }

        const structuredData = {
            headers: [],
            rows: [],
            summary: {
                totalRows: data.length,
                totalColumns: 0,
                dataTypes: {}
            }
        };

        // Detect headers (first row or look for common patterns)
        let headers = data[0];

        // If first row looks like data (mostly numbers), use generic headers
        if (this.isDataRow(headers)) {
            headers = Array.from({length: Object.keys(headers).length}, (_, i) => `Column_${i + 1}`);
            structuredData.rows = data;
        } else {
            structuredData.headers = Object.values(headers);
            structuredData.rows = data.slice(1);
        }

        structuredData.summary.totalColumns = structuredData.headers.length;

        // Analyze data types and extract key information
        structuredData.rows.forEach((row, rowIndex) => {
            const rowData = typeof row === 'object' ? Object.values(row) : [row];

            rowData.forEach((cell, colIndex) => {
                if (!structuredData.summary.dataTypes[colIndex]) {
                    structuredData.summary.dataTypes[colIndex] = {
                        type: this.detectDataType(cell),
                        count: 0,
                        examples: []
                    };
                }

                const typeInfo = structuredData.summary.dataTypes[colIndex];
                typeInfo.count++;

                if (typeInfo.examples.length < 3) {
                    typeInfo.examples.push(cell);
                }
            });
        });

        return structuredData;
    }

    static isDataRow(row) {
        if (typeof row !== 'object') return false;

        const values = Object.values(row);
        const numericCount = values.filter(val =>
            !isNaN(parseFloat(val)) && isFinite(val)
        ).length;

        return numericCount / values.length > 0.7; // 70% numeric values
    }

    static detectDataType(value) {
        if (value === null || value === undefined || value === '') {
            return 'empty';
        }

        const strValue = String(value).trim();

        // Date detection
        if (this.isDate(strValue)) {
            return 'date';
        }

        // Number detection
        if (!isNaN(parseFloat(strValue)) && isFinite(strValue)) {
            return parseFloat(strValue) % 1 === 0 ? 'integer' : 'decimal';
        }

        // Email detection
        if (this.isEmail(strValue)) {
            return 'email';
        }

        // Phone detection
        if (this.isPhone(strValue)) {
            return 'phone';
        }

        // URL detection
        if (this.isUrl(strValue)) {
            return 'url';
        }

        return 'text';
    }

    static isDate(str) {
        // Simple date regex patterns
        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}$/,
            /^\d{2}\/\d{2}\/\d{4}$/,
            /^\d{2}-\d{2}-\d{4}$/,
            /^\d{1,2}\/\d{1,2}\/\d{2,4}$/
        ];

        return datePatterns.some(pattern => pattern.test(str));
    }

    static isEmail(str) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(str);
    }

    static isPhone(str) {
        const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
        return phoneRegex.test(str.replace(/\s/g, ''));
    }

    static isUrl(str) {
        const urlRegex = /^https?:\/\/[^\s]+$/;
        return urlRegex.test(str);
    }

    static analyzeDocumentStructure(text) {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        // Basic structure analysis
        const structure = {
            totalLines: lines.length,
            totalWords: text.split(/\s+/).length,
            hasHeader: this.detectHeader(lines),
            hasFooter: this.detectFooter(lines),
            sections: this.identifySections(lines),
            keyValuePairs: this.extractKeyValuePairs(text),
            tables: this.detectTables(text)
        };

        return structure;
    }

    static detectHeader(lines) {
        // Simple heuristic: first few lines that look like headers
        const headerPatterns = [
            /^[\w\s]+$/,
            /^\d+\.\s+[\w\s]+$/,
            /^[\w\s]+:\s*$/
        ];

        return lines.slice(0, 5).some(line =>
            headerPatterns.some(pattern => pattern.test(line))
        );
    }

    static detectFooter(lines) {
        // Simple heuristic: last few lines that look like footers
        const footerPatterns = [
            /page\s+\d+/i,
            /confidential/i,
            /copyright/i,
            /\d{4}$/ // Year at end
        ];

        return lines.slice(-5).some(line =>
            footerPatterns.some(pattern => pattern.test(line))
        );
    }

    static identifySections(lines) {
        const sections = [];
        let currentSection = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check if this looks like a section header
            if (this.isSectionHeader(line)) {
                if (currentSection) {
                    sections.push(currentSection);
                }
                currentSection = {
                    title: line,
                    startLine: i,
                    content: []
                };
            } else if (currentSection) {
                currentSection.content.push(line);
            }
        }

        if (currentSection) {
            sections.push(currentSection);
        }

        return sections;
    }

    static isSectionHeader(line) {
        // Heuristics for detecting section headers
        return (
            line.length > 0 &&
            line.length < 100 &&
            !line.includes('.') &&
            (line === line.toUpperCase() ||
             /^\d+\.\s+/.test(line) ||
             /^[A-Z][a-z]+/.test(line))
        );
    }

    static extractKeyValuePairs(text) {
        const pairs = [];

        // Common patterns for key-value pairs
        const patterns = [
            /(\w+):\s*([^:\n]+)/g,
            /(\w+)\s*=\s*([^=\n]+)/g,
            /(\w+)\s*-\s*([^-\n]+)/g
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                pairs.push({
                    key: match[1].trim(),
                    value: match[2].trim(),
                    confidence: 0.8
                });
            }
        });

        return pairs;
    }

    static detectTables(text) {
        const lines = text.split('\n');
        const tables = [];

        // Simple table detection based on alignment and separators
        const tableLines = lines.filter(line =>
            line.includes('|') ||
            line.includes('\t') ||
            /\s{2,}/.test(line) // Multiple spaces suggesting columns
        );

        if (tableLines.length > 2) {
            tables.push({
                startLine: lines.indexOf(tableLines[0]),
                endLine: lines.indexOf(tableLines[tableLines.length - 1]),
                content: tableLines,
                confidence: 0.6
            });
        }

        return tables;
    }

    static extractBusinessData(text, documentType) {
        const extractedData = {};

        // Auto-detect document type if not specified
        if (!documentType) {
            documentType = this.detectDocumentType(text);
        }

        // Check if this is structured data (from Excel/CSV)
        if (text.includes('--- Structured Data ---')) {
            try {
                const structuredSection = text.split('--- Structured Data ---')[1];
                const structuredData = JSON.parse(structuredSection.trim());

                // Extract data from structured format
                return this.extractFromStructuredData(structuredData, documentType);
            } catch (error) {
                console.warn('Failed to parse structured data:', error.message);
            }
        }

        // Normalize text for better processing
        const normalizedText = text.toLowerCase();

        // Extract based on document type
        switch (documentType) {
            case 'sales_contract':
                return this.extractSalesContractData(text, normalizedText);
            case 'purchase_order':
                return this.extractPurchaseOrderData(text, normalizedText);
            case 'invoice':
                return this.extractInvoiceData(text, normalizedText);
            case 'spreadsheet':
                return this.extractSpreadsheetData(text, normalizedText);
            default:
                return this.extractGenericData(text, normalizedText);
        }
    }

    static detectDocumentType(text) {
        const normalizedText = text.toLowerCase();

        // Check for Excel/CSV indicators
        if (text.includes('--- Structured Data ---') ||
            text.includes('Sheet:') ||
            normalizedText.includes('worksheet') ||
            normalizedText.includes('spreadsheet')) {
            return 'spreadsheet';
        }

        // Check for invoice patterns
        if (normalizedText.includes('invoice') ||
            normalizedText.includes('factuur') ||
            normalizedText.includes('total amount') ||
            normalizedText.includes('btw') ||
            normalizedText.includes('tax')) {
            return 'invoice';
        }

        // Check for purchase order patterns
        if (normalizedText.includes('purchase order') ||
            normalizedText.includes('po number') ||
            normalizedText.includes('bestelbon') ||
            normalizedText.includes('order number')) {
            return 'purchase_order';
        }

        // Check for sales contract patterns
        if (normalizedText.includes('sales contract') ||
            normalizedText.includes('agreement') ||
            normalizedText.includes('contract') ||
            normalizedText.includes('terms and conditions')) {
            return 'sales_contract';
        }

        return 'generic';
    }

    static detectDocumentTypeFromExtension(filePath) {
        const extension = path.extname(filePath).toLowerCase();

        switch (extension) {
            case '.pdf':
                return 'invoice'; // Default assumption
            case '.docx':
            case '.doc':
                return 'contract'; // Could be various types
            case '.xlsx':
            case '.xls':
            case '.csv':
                return 'spreadsheet';
            case '.txt':
                return 'generic';
            default:
                return 'generic';
        }
    }

    static extractFromStructuredData(structuredData, documentType) {
        const data = {};

        // Process each sheet/tab
        for (const [sheetName, sheetData] of Object.entries(structuredData)) {
            if (sheetName === 'summary') continue;

            data[`${sheetName}_headers`] = sheetData.headers;
            data[`${sheetName}_row_count`] = sheetData.summary.totalRows;
            data[`${sheetName}_column_count`] = sheetData.summary.totalColumns;

            // Extract key columns based on data types
            sheetData.summary.dataTypes.forEach((typeInfo, colIndex) => {
                const header = sheetData.headers[colIndex] || `Column_${colIndex + 1}`;

                switch (typeInfo.type) {
                    case 'email':
                        if (typeInfo.count > 0) {
                            data[`${sheetName}_${header.replace(/\s+/g, '_').toLowerCase()}`] =
                                typeInfo.examples.join(', ');
                        }
                        break;
                    case 'date':
                        if (typeInfo.count > 0) {
                            data[`${sheetName}_${header.replace(/\s+/g, '_').toLowerCase()}_dates`] =
                                typeInfo.examples.join(', ');
                        }
                        break;
                    case 'decimal':
                    case 'integer':
                        // Calculate totals for numeric columns
                        const numericValues = sheetData.rows
                            .map(row => typeof row === 'object' ? Object.values(row)[colIndex] : row[colIndex])
                            .filter(val => !isNaN(parseFloat(val)) && isFinite(val))
                            .map(val => parseFloat(val));

                        if (numericValues.length > 0) {
                            data[`${sheetName}_${header.replace(/\s+/g, '_').toLowerCase()}_total`] =
                                numericValues.reduce((sum, val) => sum + val, 0);
                            data[`${sheetName}_${header.replace(/\s+/g, '_').toLowerCase()}_count`] =
                                numericValues.length;
                        }
                        break;
                }
            });

            // Extract first few rows as sample data
            if (sheetData.rows.length > 0) {
                data[`${sheetName}_sample_data`] = sheetData.rows.slice(0, 3);
            }
        }

        return data;
    }

    static extractSpreadsheetData(text, normalizedText) {
        const data = {};

        // Look for common spreadsheet patterns
        const patterns = [
            /total[:\s]*\$?([\d,]+\.?\d*)/gi,
            /invoice[:\s]*#?([^\s\n]+)/gi,
            /order[:\s]*#?([^\s\n]+)/gi,
            /date[:\s]*([^\s\n]+)/gi,
            /customer[:\s]*([^\s\n]+)/gi,
            /supplier[:\s]*([^\s\n]+)/gi
        ];

        patterns.forEach(pattern => {
            const match = pattern.exec(normalizedText);
            if (match) {
                const key = pattern.toString().split('[:\\s]*')[0].replace('/', '');
                data[key] = match[1].trim();
            }
        });

        return data;
    }

    static extractSalesContractData(text, normalizedText) {
        const data = {};

        // Extract product information
        const productPatterns = [
            /product[s]?:\s*([^:\n]+)/gi,
            /item[s]?:\s*([^:\n]+)/gi,
            /description:\s*([^:\n]+)/gi
        ];

        productPatterns.forEach(pattern => {
            const match = pattern.exec(normalizedText);
            if (match) {
                data.product_description = match[1].trim();
            }
        });

        // Extract quantities
        const quantityMatch = normalizedText.match(/quantity:\s*(\d+(?:\.\d+)?)/i);
        if (quantityMatch) {
            data.quantity = parseFloat(quantityMatch[1]);
        }

        // Extract prices
        const priceMatch = normalizedText.match(/price:\s*\$?(\d+(?:\.\d+)?)/i);
        if (priceMatch) {
            data.unit_price = parseFloat(priceMatch[1]);
        }

        // Extract dates
        const datePatterns = [
            /delivery\s+date:\s*([^:\n]+)/gi,
            /due\s+date:\s*([^:\n]+)/gi,
            /date:\s*([^:\n]+)/gi
        ];

        datePatterns.forEach(pattern => {
            const match = pattern.exec(normalizedText);
            if (match) {
                data.delivery_date = match[1].trim();
            }
        });

        // Extract payment terms
        const paymentMatch = normalizedText.match(/payment\s+terms?:\s*([^:\n]+)/gi);
        if (paymentMatch) {
            data.payment_terms = paymentMatch[1].trim();
        }

        return data;
    }

    static extractPurchaseOrderData(text, normalizedText) {
        const data = {};

        // Similar extraction logic for purchase orders
        const supplierMatch = normalizedText.match(/supplier:\s*([^:\n]+)/gi);
        if (supplierMatch) {
            data.supplier = supplierMatch[1].trim();
        }

        // Extract order details
        const orderPatterns = [
            /order\s+number:\s*([^:\n]+)/gi,
            /po\s+number:\s*([^:\n]+)/gi
        ];

        orderPatterns.forEach(pattern => {
            const match = pattern.exec(normalizedText);
            if (match) {
                data.order_number = match[1].trim();
            }
        });

        return data;
    }

    static extractInvoiceData(text, normalizedText) {
        const data = {};

        // Extract invoice details
        const invoiceMatch = normalizedText.match(/invoice\s+number:\s*([^:\n]+)/gi);
        if (invoiceMatch) {
            data.invoice_number = invoiceMatch[1].trim();
        }

        // Extract amounts
        const amountMatch = normalizedText.match(/total\s+amount:\s*\$?(\d+(?:\.\d+)?)/gi);
        if (amountMatch) {
            data.total_amount = parseFloat(amountMatch[1]);
        }

        return data;
    }

    static extractGenericData(text, normalizedText) {
        const data = {};

        // Generic extraction for unknown document types
        const keyValuePairs = this.extractKeyValuePairs(text);

        keyValuePairs.forEach(pair => {
            data[pair.key.toLowerCase()] = pair.value;
        });

        return data;
    }

    static calculateConfidence(extractedData) {
        // Simple confidence calculation based on data completeness
        const fields = Object.keys(extractedData);
        const totalFields = fields.length;

        if (totalFields === 0) return 0;

        // Weight different fields differently
        const importantFields = ['product_description', 'quantity', 'unit_price', 'total_amount'];
        const importantFound = importantFields.filter(field => extractedData[field]).length;

        return Math.min(1.0, (importantFound * 0.3) + (totalFields * 0.1));
    }
}

module.exports = DocumentProcessor;













