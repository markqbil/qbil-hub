-- Qbil Hub Database Schema (SQLite)
-- B2B Document Exchange Hub

-- Companies table (represents trading companies)
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    business_id TEXT UNIQUE NOT NULL,
    email_domain TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1
);

-- Users table (users within companies)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Trading partner connections (establishes connections between companies)
CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    initiator_company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    target_company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'approved', 'declined', 'suspended')) DEFAULT 'pending',
    initiated_by TEXT REFERENCES users(id),
    approved_by TEXT REFERENCES users(id),
    initiated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    suspended_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(initiator_company_id, target_company_id)
);

-- Documents table (stores document metadata and content)
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    sender_company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    recipient_company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    connection_id TEXT REFERENCES connections(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL, -- 'sales_contract', 'purchase_order', etc.
    original_filename TEXT,
    file_path TEXT,
    file_size INTEGER,
    mime_type TEXT,
    status TEXT CHECK (status IN ('sent', 'delivered', 'processed', 'failed')) DEFAULT 'sent',
    priority TEXT CHECK (priority IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
    created_by TEXT REFERENCES users(id),
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    delivered_at DATETIME,
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Document recipients (specific users who should receive notifications)
CREATE TABLE IF NOT EXISTS document_recipients (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    recipient_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    is_acknowledged INTEGER DEFAULT 0,
    acknowledged_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, recipient_user_id)
);

-- Document content (extracted data from documents for processing)
CREATE TABLE IF NOT EXISTS document_content (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL, -- 'product_code', 'quantity', 'price', etc.
    field_value TEXT,
    confidence_score REAL, -- 0.00 to 1.00
    is_verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product mappings (learned mappings between companies' product codes)
CREATE TABLE IF NOT EXISTS product_mappings (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    from_company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    to_company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    from_product_code TEXT NOT NULL,
    to_product_code TEXT NOT NULL,
    confidence_score REAL DEFAULT 0.00,
    usage_count INTEGER DEFAULT 0,
    last_used DATETIME,
    is_manual INTEGER DEFAULT 0, -- true if manually created/edited
    created_by TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(from_company_id, to_company_id, from_product_code)
);

-- Document mappings (specific mappings used for each document)
CREATE TABLE IF NOT EXISTS document_mappings (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    document_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
    from_company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    to_company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    original_value TEXT NOT NULL,
    mapped_value TEXT NOT NULL,
    mapping_source TEXT, -- 'auto', 'manual', 'product_mapping'
    confidence_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT
);

-- Audit log (tracks all important actions)
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'connection_requested', 'document_sent', etc.
    resource_type TEXT, -- 'connection', 'document', 'user'
    resource_id TEXT,
    details TEXT, -- flexible storage for action details (JSON string)
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance (SQLite creates these automatically for unique constraints)
-- Additional indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company_active ON users(company_id, is_active); -- Compound index
CREATE INDEX IF NOT EXISTS idx_connections_initiator ON connections(initiator_company_id);
CREATE INDEX IF NOT EXISTS idx_connections_target ON connections(target_company_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);
CREATE INDEX IF NOT EXISTS idx_connections_companies ON connections(initiator_company_id, target_company_id); -- Compound index
CREATE INDEX IF NOT EXISTS idx_documents_sender ON documents(sender_company_id);
CREATE INDEX IF NOT EXISTS idx_documents_recipient ON documents(recipient_company_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_sender_created ON documents(sender_company_id, created_at DESC); -- Compound index for pagination
CREATE INDEX IF NOT EXISTS idx_documents_recipient_created ON documents(recipient_company_id, created_at DESC); -- Compound index for pagination
CREATE INDEX IF NOT EXISTS idx_documents_connection_created ON documents(connection_id, created_at DESC); -- Compound index
CREATE INDEX IF NOT EXISTS idx_documents_status_created ON documents(status, created_at DESC); -- Compound index for filtering
CREATE INDEX IF NOT EXISTS idx_document_recipients_document ON document_recipients(document_id);
CREATE INDEX IF NOT EXISTS idx_document_recipients_user ON document_recipients(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_document_recipients_user_ack ON document_recipients(recipient_user_id, is_acknowledged); -- Compound index
CREATE INDEX IF NOT EXISTS idx_document_content_document ON document_content(document_id);
CREATE INDEX IF NOT EXISTS idx_document_content_doc_field ON document_content(document_id, field_name); -- Compound index
CREATE INDEX IF NOT EXISTS idx_product_mappings_from_company ON product_mappings(from_company_id);
CREATE INDEX IF NOT EXISTS idx_product_mappings_to_company ON product_mappings(to_company_id);
CREATE INDEX IF NOT EXISTS idx_product_mappings_from_to ON product_mappings(from_company_id, to_company_id); -- Compound index
CREATE INDEX IF NOT EXISTS idx_product_mappings_lookup ON product_mappings(from_company_id, to_company_id, from_product_code); -- Covering index
CREATE INDEX IF NOT EXISTS idx_audit_log_company ON audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_company_created ON audit_log(company_id, created_at DESC); -- Compound index for pagination
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id); -- Compound index
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- Sample data for testing
INSERT OR IGNORE INTO companies (name, business_id, email_domain) VALUES
('Trading Company A', 'TCA001', 'companya.com'),
('Trading Company B', 'TCB002', 'companyb.com'),
('Trading Company C', 'TCC003', 'companyc.com');

-- Sample users
INSERT OR IGNORE INTO users (company_id, email, password_hash, first_name, last_name, is_admin)
SELECT
    (SELECT id FROM companies WHERE business_id = 'TCA001'),
    'admin@companya.com',
    '$2a$10$dummy.hash.for.demo.purposes.only',
    'Admin',
    'User A',
    1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@companya.com');

INSERT OR IGNORE INTO users (company_id, email, password_hash, first_name, last_name, is_admin)
SELECT
    (SELECT id FROM companies WHERE business_id = 'TCB002'),
    'admin@companyb.com',
    '$2a$10$dummy.hash.for.demo.purposes.only',
    'Admin',
    'User B',
    1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@companyb.com');

INSERT OR IGNORE INTO users (company_id, email, password_hash, first_name, last_name, is_admin)
SELECT
    (SELECT id FROM companies WHERE business_id = 'TCC003'),
    'admin@companyc.com',
    '$2a$10$dummy.hash.for.demo.purposes.only',
    'Admin',
    'User C',
    1
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@companyc.com');

-- Sample connection
INSERT OR IGNORE INTO connections (initiator_company_id, target_company_id, status, initiated_by, approved_by)
SELECT
    (SELECT id FROM companies WHERE business_id = 'TCA001'),
    (SELECT id FROM companies WHERE business_id = 'TCB002'),
    'approved',
    (SELECT id FROM users WHERE email = 'admin@companya.com'),
    (SELECT id FROM users WHERE email = 'admin@companyb.com')
WHERE NOT EXISTS (
    SELECT 1 FROM connections
    WHERE initiator_company_id = (SELECT id FROM companies WHERE business_id = 'TCA001')
    AND target_company_id = (SELECT id FROM companies WHERE business_id = 'TCB002')
);
