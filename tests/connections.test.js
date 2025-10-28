const request = require('supertest');
const app = require('../server');
const { query } = require('../src/utils/database');

describe('Connections Endpoints', () => {
  let company1, company2, company3;
  let adminUser1, adminUser2;

  beforeEach(async () => {
    // Create test companies
    company1 = await createTestCompany({
      name: 'Company 1',
      business_id: 'COMP1',
      email_domain: 'comp1.com'
    });

    company2 = await createTestCompany({
      name: 'Company 2',
      business_id: 'COMP2',
      email_domain: 'comp2.com'
    });

    company3 = await createTestCompany({
      name: 'Company 3',
      business_id: 'COMP3',
      email_domain: 'comp3.com'
    });

    // Create admin users
    adminUser1 = await createTestUser({
      email: 'admin1@comp1.com',
      company_id: company1.id,
      is_admin: true
    });

    adminUser2 = await createTestUser({
      email: 'admin2@comp2.com',
      company_id: company2.id,
      is_admin: true
    });
  });

  afterEach(async () => {
    // Clean up test data
    await query('DELETE FROM connections WHERE initiator_company_id IN (?, ?, ?) OR target_company_id IN (?, ?, ?)', 
      [company1.id, company2.id, company3.id, company1.id, company2.id, company3.id]);
    await query('DELETE FROM users WHERE company_id IN (?, ?, ?)', [company1.id, company2.id, company3.id]);
    await query('DELETE FROM companies WHERE id IN (?, ?, ?)', [company1.id, company2.id, company3.id]);
  });

  describe('GET /api/connections/search-companies', () => {
    let accessToken;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin1@comp1.com',
          password: 'testpassword123'
        });
      
      accessToken = loginResponse.body.access_token;
    });

    it('should search companies by name', async () => {
      const response = await request(app)
        .get('/api/connections/search-companies?search=Company')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('companies');
      expect(response.body.companies.length).toBeGreaterThan(0);
      expect(response.body.companies).not.toContainEqual(
        expect.objectContaining({ id: company1.id })
      );
    });

    it('should search companies by business ID', async () => {
      const response = await request(app)
        .get('/api/connections/search-companies?search=COMP2')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.companies).toContainEqual(
        expect.objectContaining({ business_id: 'COMP2' })
      );
    });

    it('should return all companies when no search term', async () => {
      const response = await request(app)
        .get('/api/connections/search-companies')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.companies.length).toBe(2); // Excludes own company
    });

    it('should reject non-admin users', async () => {
      const regularUser = await createTestUser({
        email: 'regular@comp1.com',
        company_id: company1.id,
        is_admin: false
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'regular@comp1.com',
          password: 'testpassword123'
        });

      const response = await request(app)
        .get('/api/connections/search-companies')
        .set('Authorization', `Bearer ${loginResponse.body.access_token}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/connections/request', () => {
    let accessToken;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin1@comp1.com',
          password: 'testpassword123'
        });
      
      accessToken = loginResponse.body.access_token;
    });

    it('should create connection request', async () => {
      const response = await request(app)
        .post('/api/connections/request')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          target_company_id: company2.id
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('connection');
      expect(response.body.connection.status).toBe('pending');
    });

    it('should reject connection to own company', async () => {
      const response = await request(app)
        .post('/api/connections/request')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          target_company_id: company1.id
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject duplicate connection request', async () => {
      // Create first connection
      await request(app)
        .post('/api/connections/request')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          target_company_id: company2.id
        });

      // Try to create duplicate
      const response = await request(app)
        .post('/api/connections/request')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          target_company_id: company2.id
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing target company ID', async () => {
      const response = await request(app)
        .post('/api/connections/request')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/connections/pending-requests', () => {
    let accessToken;

    beforeEach(async () => {
      // Create connection request from company1 to company2
      await query(
        'INSERT INTO connections (initiator_company_id, target_company_id, initiated_by) VALUES (?, ?, ?)',
        [company1.id, company2.id, adminUser1.id]
      );

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin2@comp2.com',
          password: 'testpassword123'
        });
      
      accessToken = loginResponse.body.access_token;
    });

    it('should return pending requests for target company', async () => {
      const response = await request(app)
        .get('/api/connections/pending-requests')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('pending_requests');
      expect(response.body.pending_requests.length).toBe(1);
      expect(response.body.pending_requests[0]).toHaveProperty('initiator_company');
    });
  });

  describe('POST /api/connections/:connection_id/approve', () => {
    let connectionId;
    let accessToken;

    beforeEach(async () => {
      // Create connection request
      const result = await query(
        'INSERT INTO connections (initiator_company_id, target_company_id, initiated_by) VALUES (?, ?, ?) RETURNING id',
        [company1.id, company2.id, adminUser1.id]
      );
      connectionId = result.rows[0].id;

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin2@comp2.com',
          password: 'testpassword123'
        });
      
      accessToken = loginResponse.body.access_token;
    });

    it('should approve connection request', async () => {
      const response = await request(app)
        .post(`/api/connections/${connectionId}/approve`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.connection.status).toBe('approved');
    });

    it('should reject approval by non-target company', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin1@comp1.com',
          password: 'testpassword123'
        });

      const response = await request(app)
        .post(`/api/connections/${connectionId}/approve`)
        .set('Authorization', `Bearer ${loginResponse.body.access_token}`);

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/connections/:connection_id/decline', () => {
    let connectionId;
    let accessToken;

    beforeEach(async () => {
      // Create connection request
      const result = await query(
        'INSERT INTO connections (initiator_company_id, target_company_id, initiated_by) VALUES (?, ?, ?) RETURNING id',
        [company1.id, company2.id, adminUser1.id]
      );
      connectionId = result.rows[0].id;

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin2@comp2.com',
          password: 'testpassword123'
        });
      
      accessToken = loginResponse.body.access_token;
    });

    it('should decline connection request', async () => {
      const response = await request(app)
        .post(`/api/connections/${connectionId}/decline`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.connection.status).toBe('declined');
    });
  });

  describe('GET /api/connections/my-connections', () => {
    let accessToken;

    beforeEach(async () => {
      // Create approved connection
      await query(
        'INSERT INTO connections (initiator_company_id, target_company_id, initiated_by, status, approved_by, approved_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [company1.id, company2.id, adminUser1.id, 'approved', adminUser2.id]
      );

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin1@comp1.com',
          password: 'testpassword123'
        });
      
      accessToken = loginResponse.body.access_token;
    });

    it('should return company connections', async () => {
      const response = await request(app)
        .get('/api/connections/my-connections')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('connections');
      expect(response.body.connections.length).toBe(1);
      expect(response.body.connections[0].status).toBe('approved');
    });
  });
});






