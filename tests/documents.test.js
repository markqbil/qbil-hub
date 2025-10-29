const request = require('supertest');
const app = require('../server');
const { query } = require('../src/utils/database');
const fs = require('fs');
const path = require('path');

describe('Documents Endpoints', () => {
  let company1, company2;
  let adminUser1, adminUser2;
  let connectionId;
  let testFilePath;

  beforeEach(async () => {
    try {
      // Create test companies
      company1 = await createTestCompany({
        name: 'Sender Company',
        business_id: 'SENDER123',
        email_domain: 'sender.com'
      });

      company2 = await createTestCompany({
        name: 'Receiver Company',
        business_id: 'RECEIVER123',
        email_domain: 'receiver.com'
      });

      // Create admin users
      adminUser1 = await createTestUser({
        email: 'admin1@sender.com',
        company_id: company1.id,
        is_admin: true
      });

      adminUser2 = await createTestUser({
        email: 'admin2@receiver.com',
        company_id: company2.id,
        is_admin: true
      });

      // Create approved connection
      const connectionResult = await query(
        'INSERT INTO connections (initiator_company_id, target_company_id, initiated_by, status, approved_by, approved_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) RETURNING id',
        [company1.id, company2.id, adminUser1.id, 'approved', adminUser2.id]
      );
      connectionId = connectionResult.rows[0].id;

      // Create test file
      testFilePath = path.join(__dirname, 'test-document.txt');
      fs.writeFileSync(testFilePath, 'This is a test document content');
    } catch (error) {
      console.error('Error in beforeEach:', error);
      throw error;
    }
  });

  afterEach(async () => {
    try {
      // Clean up test data only if companies were created
      if (company1 && company1.id && company2 && company2.id) {
        await query('DELETE FROM document_content WHERE document_id IN (SELECT id FROM documents WHERE sender_company_id IN (?, ?) OR recipient_company_id IN (?, ?))', 
          [company1.id, company2.id, company1.id, company2.id]);
        await query('DELETE FROM document_recipients WHERE document_id IN (SELECT id FROM documents WHERE sender_company_id IN (?, ?) OR recipient_company_id IN (?, ?))', 
          [company1.id, company2.id, company1.id, company2.id]);
        await query('DELETE FROM documents WHERE sender_company_id IN (?, ?) OR recipient_company_id IN (?, ?)', 
          [company1.id, company2.id, company1.id, company2.id]);
        await query('DELETE FROM connections WHERE initiator_company_id IN (?, ?) OR target_company_id IN (?, ?)', 
          [company1.id, company2.id, company1.id, company2.id]);
        await query('DELETE FROM users WHERE company_id IN (?, ?)', [company1.id, company2.id]);
        await query('DELETE FROM companies WHERE id IN (?, ?)', [company1.id, company2.id]);
      }

      // Clean up test file
      if (testFilePath && fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    } catch (error) {
      console.error('Error in afterEach:', error);
    }
  });

  describe('POST /api/documents/send', () => {
    let accessToken;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin1@sender.com',
          password: 'testpassword123'
        });
      
      accessToken = loginResponse.body.access_token;
    });

    it('should send document with valid data', async () => {
      const response = await request(app)
        .post('/api/documents/send')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('recipient_company_id', company2.id)
        .field('document_type', 'invoice')
        .field('priority', 'high')
        .attach('document', testFilePath);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('document');
      expect(response.body.document.document_type).toBe('invoice');
      expect(response.body.document.priority).toBe('high');
    });

    it('should reject document without file', async () => {
      const response = await request(app)
        .post('/api/documents/send')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('recipient_company_id', company2.id)
        .field('document_type', 'invoice');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject document without required fields', async () => {
      const response = await request(app)
        .post('/api/documents/send')
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('document', testFilePath);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject document to company without connection', async () => {
      // Create company without connection
      const company3 = await createTestCompany({
        name: 'No Connection Company',
        business_id: 'NO_CONN',
        email_domain: 'noconn.com'
      });

      const response = await request(app)
        .post('/api/documents/send')
        .set('Authorization', `Bearer ${accessToken}`)
        .field('recipient_company_id', company3.id)
        .field('document_type', 'invoice')
        .attach('document', testFilePath);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      // Clean up
      await query('DELETE FROM companies WHERE id = ?', [company3.id]);
    });
  });

  describe('GET /api/documents/sent', () => {
    let accessToken;
    let documentId;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin1@sender.com',
          password: 'testpassword123'
        });
      
      accessToken = loginResponse.body.access_token;

      // Create test document
      const docResult = await query(
        `INSERT INTO documents 
         (sender_company_id, recipient_company_id, connection_id, document_type, 
          original_filename, file_path, file_size, mime_type, priority, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        [company1.id, company2.id, connectionId, 'invoice', 
         'test-document.txt', testFilePath, 1000, 'text/plain', 'normal', 'sent']
      );
      documentId = docResult.rows[0].id;
    });

    it('should return sent documents', async () => {
      const response = await request(app)
        .get('/api/documents/sent')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('documents');
      expect(response.body.documents.length).toBe(1);
      expect(response.body.documents[0].document_type).toBe('invoice');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/documents/sent?limit=10&offset=0')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.offset).toBe(0);
    });
  });

  describe('GET /api/documents/received', () => {
    let accessToken;
    let documentId;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin2@receiver.com',
          password: 'testpassword123'
        });
      
      accessToken = loginResponse.body.access_token;

      // Create test document
      const docResult = await query(
        `INSERT INTO documents 
         (sender_company_id, recipient_company_id, connection_id, document_type, 
          original_filename, file_path, file_size, mime_type, priority, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        [company1.id, company2.id, connectionId, 'invoice', 
         'test-document.txt', testFilePath, 1000, 'text/plain', 'normal', 'delivered']
      );
      documentId = docResult.rows[0].id;

      // Add recipient
      await query(
        'INSERT INTO document_recipients (document_id, recipient_user_id) VALUES (?, ?)',
        [documentId, adminUser2.id]
      );
    });

    it('should return received documents', async () => {
      const response = await request(app)
        .get('/api/documents/received')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('documents');
      expect(response.body.documents.length).toBe(1);
      expect(response.body.documents[0].document_type).toBe('invoice');
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/documents/received?status=delivered')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.documents.length).toBe(1);
    });
  });

  describe('GET /api/documents/:document_id', () => {
    let accessToken;
    let documentId;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin1@sender.com',
          password: 'testpassword123'
        });
      
      accessToken = loginResponse.body.access_token;

      // Create test document
      const docResult = await query(
        `INSERT INTO documents 
         (sender_company_id, recipient_company_id, connection_id, document_type, 
          original_filename, file_path, file_size, mime_type, priority, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        [company1.id, company2.id, connectionId, 'invoice', 
         'test-document.txt', testFilePath, 1000, 'text/plain', 'normal', 'sent']
      );
      documentId = docResult.rows[0].id;
    });

    it('should return document details for sender', async () => {
      const response = await request(app)
        .get(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('document');
      expect(response.body.document.id).toBe(documentId);
      expect(response.body.document.document_type).toBe('invoice');
    });

    it('should return document details for recipient', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin2@receiver.com',
          password: 'testpassword123'
        });

      // Add recipient
      await query(
        'INSERT INTO document_recipients (document_id, recipient_user_id) VALUES (?, ?)',
        [documentId, adminUser2.id]
      );

      const response = await request(app)
        .get(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${loginResponse.body.access_token}`);

      expect(response.status).toBe(200);
      expect(response.body.document.id).toBe(documentId);
    });

    it('should reject access for unauthorized user', async () => {
      const unauthorizedCompany = await createTestCompany({
        name: 'Unauthorized Company',
        business_id: 'UNAUTH',
        email_domain: 'unauth.com'
      });

      const unauthorizedUser = await createTestUser({
        email: 'unauth@unauth.com',
        company_id: unauthorizedCompany.id,
        is_admin: true
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unauth@unauth.com',
          password: 'testpassword123'
        });

      const response = await request(app)
        .get(`/api/documents/${documentId}`)
        .set('Authorization', `Bearer ${loginResponse.body.access_token}`);

      expect(response.status).toBe(403);

      // Clean up
      await query('DELETE FROM users WHERE company_id = ?', [unauthorizedCompany.id]);
      await query('DELETE FROM companies WHERE id = ?', [unauthorizedCompany.id]);
    });
  });

  describe('POST /api/documents/:document_id/acknowledge', () => {
    let accessToken;
    let documentId;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin2@receiver.com',
          password: 'testpassword123'
        });
      
      accessToken = loginResponse.body.access_token;

      // Create test document
      const docResult = await query(
        `INSERT INTO documents 
         (sender_company_id, recipient_company_id, connection_id, document_type, 
          original_filename, file_path, file_size, mime_type, priority, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        [company1.id, company2.id, connectionId, 'invoice', 
         'test-document.txt', testFilePath, 1000, 'text/plain', 'normal', 'delivered']
      );
      documentId = docResult.rows[0].id;

      // Add recipient
      await query(
        'INSERT INTO document_recipients (document_id, recipient_user_id) VALUES (?, ?)',
        [documentId, adminUser2.id]
      );
    });

    it('should acknowledge document', async () => {
      const response = await request(app)
        .post(`/api/documents/${documentId}/acknowledge`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject acknowledgment by non-recipient', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin1@sender.com',
          password: 'testpassword123'
        });

      const response = await request(app)
        .post(`/api/documents/${documentId}/acknowledge`)
        .set('Authorization', `Bearer ${loginResponse.body.access_token}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/documents/stats/overview', () => {
    let accessToken;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin1@sender.com',
          password: 'testpassword123'
        });
      
      accessToken = loginResponse.body.access_token;
    });

    it('should return document statistics', async () => {
      const response = await request(app)
        .get('/api/documents/stats/overview')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('stats');
      expect(response.body.stats).toHaveProperty('sent');
      expect(response.body.stats).toHaveProperty('received');
      expect(response.body.stats).toHaveProperty('delivered');
      expect(response.body.stats).toHaveProperty('processed');
    });
  });
});






