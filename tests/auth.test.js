const request = require('supertest');
const app = require('../server');
const { query } = require('../src/utils/database');

describe('Auth Endpoints', () => {
  let testCompany;
  let testUser;

  beforeEach(async () => {
    // Create test company
    testCompany = await createTestCompany({
      name: 'Test Company',
      business_id: 'TEST123',
      email_domain: 'test.com'
    });

    // Create test user
    testUser = await createTestUser({
      email: 'test@example.com',
      company_id: testCompany.id,
      is_admin: true
    });
  });

  afterEach(async () => {
    // Clean up test data
    await query('DELETE FROM users WHERE company_id = ?', [testCompany.id]);
    await query('DELETE FROM companies WHERE id = ?', [testCompany.id]);
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('refresh_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user and company', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@newcompany.com',
          password: 'newpassword123',
          first_name: 'New',
          last_name: 'User',
          company_name: 'New Company',
          business_id: 'NEW123',
          is_admin: true
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('newuser@newcompany.com');
      expect(response.body.user.is_admin).toBe(true);
    });

    it('should register user to existing company', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'another@test.com',
          password: 'password123',
          first_name: 'Another',
          last_name: 'User',
          company_name: 'Test Company',
          business_id: 'TEST123',
          is_admin: false
        });

      expect(response.status).toBe(201);
      expect(response.body.user.company_id).toBe(testCompany.id);
    });

    it('should reject duplicate email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          first_name: 'Duplicate',
          last_name: 'User',
          company_name: 'Test Company',
          business_id: 'TEST123'
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'incomplete@test.com',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        });
      
      refreshToken = loginResponse.body.refresh_token;
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refresh_token: refreshToken
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('token_type', 'Bearer');
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refresh_token: 'invalid_token'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken;

    beforeEach(async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        });
      
      accessToken = loginResponse.body.access_token;
    });

    it('should return user info with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.company).toBeDefined();
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});






