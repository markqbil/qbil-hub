const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/**
 * Email Service
 * Handles all email notifications using nodemailer
 */
class EmailService {
    constructor() {
        this.enabled = process.env.EMAIL_ENABLED === 'true';
        this.from = process.env.EMAIL_FROM || 'noreply@qbilhub.com';
        this.transporter = null;
        
        if (this.enabled) {
            this.initializeTransporter();
            logger.info('Email service enabled', { from: this.from });
        } else {
            logger.info('Email service disabled (placeholder mode)');
        }
    }

    /**
     * Initialize nodemailer transporter
     */
    initializeTransporter() {
        try {
            const smtpConfig = {
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            };

            // Validate required config
            if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
                logger.warn('Email enabled but SMTP credentials missing. Falling back to placeholder mode.');
                this.enabled = false;
                return;
            }

            this.transporter = nodemailer.createTransport(smtpConfig);

            // Verify connection
            this.transporter.verify((error, success) => {
                if (error) {
                    logger.error('SMTP connection failed', { error: error.message });
                    this.enabled = false;
                } else {
                    logger.info('SMTP connection verified successfully');
                }
            });
        } catch (error) {
            logger.error('Failed to initialize email transporter', { error: error.message });
            this.enabled = false;
        }
    }

    /**
     * Send email using nodemailer
     */
    async sendEmail(options) {
        const { to, subject, text, html } = options;

        if (!this.enabled || !this.transporter) {
            logger.debug('Email placeholder: Would send email', {
                to,
                subject,
                from: this.from
            });
            return { success: true, message: 'Email disabled (placeholder mode)' };
        }

        try {
            const mailOptions = {
                from: this.from,
                to,
                subject,
                text,
                html: html || text.replace(/\n/g, '<br>')
            };

            const info = await this.transporter.sendMail(mailOptions);
            
            logger.info('Email sent successfully', { 
                to, 
                subject, 
                messageId: info.messageId 
            });
            
            return { 
                success: true, 
                messageId: info.messageId,
                response: info.response
            };
        } catch (error) {
            logger.error('Email send failed', { error: error.message, to, subject });
            throw error;
        }
    }

    /**
     * Send connection request notification
     */
    async notifyConnectionRequest(targetUser, initiatorCompany, connectionId) {
        const subject = `New Connection Request from ${initiatorCompany.name}`;
        const text = `
Hello ${targetUser.first_name},

${initiatorCompany.name} has sent you a connection request on Qbil Hub.

Please log in to review and approve or decline this request.

Connection ID: ${connectionId}

Best regards,
Qbil Hub Team
        `;

        return await this.sendEmail({
            to: targetUser.email,
            subject,
            text
        });
    }

    /**
     * Send connection approved notification
     */
    async notifyConnectionApproved(initiatorUser, targetCompany) {
        const subject = `Connection Approved by ${targetCompany.name}`;
        const text = `
Hello ${initiatorUser.first_name},

Great news! ${targetCompany.name} has approved your connection request on Qbil Hub.

You can now start exchanging documents with ${targetCompany.name}.

Best regards,
Qbil Hub Team
        `;

        return await this.sendEmail({
            to: initiatorUser.email,
            subject,
            text
        });
    }

    /**
     * Send document received notification
     */
    async notifyDocumentReceived(recipient, document, senderCompany) {
        const subject = `New Document from ${senderCompany.name}`;
        const text = `
Hello ${recipient.first_name},

You have received a new ${document.document_type} document from ${senderCompany.name} on Qbil Hub.

Document: ${document.original_filename}
Priority: ${document.priority}
Received: ${new Date().toLocaleString()}

Please log in to view and process this document.

Best regards,
Qbil Hub Team
        `;

        return await this.sendEmail({
            to: recipient.email,
            subject,
            text
        });
    }

    /**
     * Send document acknowledged notification
     */
    async notifyDocumentAcknowledged(sender, document, recipientUser) {
        const subject = `Document Acknowledged by ${recipientUser.first_name} ${recipientUser.last_name}`;
        const text = `
Hello ${sender.first_name},

Your document has been acknowledged by ${recipientUser.first_name} ${recipientUser.last_name}.

Document: ${document.original_filename}
Acknowledged: ${new Date().toLocaleString()}

Best regards,
Qbil Hub Team
        `;

        return await this.sendEmail({
            to: sender.email,
            subject,
            text
        });
    }

    /**
     * Send bulk notification to multiple recipients
     */
    async sendBulkEmails(emails) {
        const results = [];
        
        for (const email of emails) {
            try {
                const result = await this.sendEmail(email);
                results.push({ ...email, ...result });
            } catch (error) {
                results.push({ ...email, success: false, error: error.message });
            }
        }

        return results;
    }

    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(user, resetToken) {
        const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
        
        const subject = 'Password Reset Request';
        const text = `
Hello ${user.first_name},

You requested a password reset for your Qbil Hub account.

Please click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you did not request this reset, please ignore this email.

Best regards,
Qbil Hub Team
        `;

        return await this.sendEmail({
            to: user.email,
            subject,
            text
        });
    }

    /**
     * Send welcome email to new users
     */
    async sendWelcomeEmail(user, company) {
        const subject = 'Welcome to Qbil Hub!';
        const text = `
Hello ${user.first_name},

Welcome to Qbil Hub - B2B Document Exchange Platform!

Your account has been successfully created for ${company.name}.

You can now:
- Connect with trading partners
- Exchange documents securely
- Automate document processing
- Use machine learning for product mapping

Log in at: ${process.env.APP_URL || 'http://localhost:3000'}

If you have any questions, please don't hesitate to contact our support team.

Best regards,
Qbil Hub Team
        `;

        return await this.sendEmail({
            to: user.email,
            subject,
            text
        });
    }
}

// Export singleton instance
const emailService = new EmailService();

module.exports = emailService;
