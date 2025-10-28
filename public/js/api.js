// API Client for Qbil Hub

class ApiClient {
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
        this.token = localStorage.getItem('access_token');
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('access_token', token);
    }

    removeToken() {
        this.token = null;
        localStorage.removeItem('access_token');
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
                ...options.headers
            },
            ...options
        };

        // Handle file uploads differently
        if (options.body instanceof FormData) {
            delete config.headers['Content-Type']; // Let browser set boundary
        }

        try {
            const response = await fetch(url, config);
            return await this.handleResponse(response);
        } catch (error) {
            console.error('API request failed:', error);
            throw new Error('Network error');
        }
    }

    async handleResponse(response) {
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }

        return response.text();
    }

    // Authentication methods
    async login(credentials) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });

        if (response.access_token) {
            this.setToken(response.access_token);
        }

        return response;
    }

    async register(userData) {
        const response = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        if (response.access_token) {
            this.setToken(response.access_token);
        }

        return response;
    }

    // Password reset methods
    async forgotPassword(email) {
        return this.request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    async resetPassword(token, password) {
        return this.request('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, password })
        });
    }

    async getCurrentUser() {
        return this.request('/auth/me');
    }

    async refreshToken() {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
            throw new Error('No refresh token available');
        }

        const response = await this.request('/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (response.access_token) {
            this.setToken(response.access_token);
        }

        return response;
    }

    // Connection methods
    async searchCompanies(searchTerm = '') {
        const params = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
        return this.request(`/connections/search-companies${params}`);
    }

    async requestConnection(targetCompanyId) {
        return this.request('/connections/request', {
            method: 'POST',
            body: JSON.stringify({ target_company_id: targetCompanyId })
        });
    }

    async getPendingRequests() {
        return this.request('/connections/pending-requests');
    }

    async approveConnection(connectionId) {
        return this.request(`/connections/${connectionId}/approve`, {
            method: 'POST'
        });
    }

    async declineConnection(connectionId) {
        return this.request(`/connections/${connectionId}/decline`, {
            method: 'POST'
        });
    }

    async getMyConnections() {
        return this.request('/connections/my-connections');
    }

    async getConnectionStats() {
        return this.request('/connections/stats');
    }

    async suspendConnection(connectionId) {
        return this.request(`/connections/${connectionId}/suspend`, {
            method: 'POST'
        });
    }

    // Document methods
    async sendDocument(formData) {
        return this.request('/documents/send', {
            method: 'POST',
            body: formData
        });
    }

    async getSentDocuments(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/documents/sent?${queryString}`);
    }

    async getReceivedDocuments(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/documents/received?${queryString}`);
    }

    async getDocument(documentId) {
        return this.request(`/documents/${documentId}`);
    }

    async acknowledgeDocument(documentId) {
        return this.request(`/documents/${documentId}/acknowledge`, {
            method: 'POST'
        });
    }

    async downloadDocument(documentId) {
        // For downloading, we use window.location to trigger browser download
        window.location.href = `/api/documents/${documentId}/download`;
    }

    async getDocumentForProcessing(documentId) {
        return this.request(`/processing/document/${documentId}`);
    }

    async processDocument(documentId, processingData) {
        return this.request(`/processing/document/${documentId}/process`, {
            method: 'POST',
            body: JSON.stringify(processingData)
        });
    }

    async getDocumentStats() {
        return this.request('/documents/stats/overview');
    }

    // Processing methods
    async getDocumentForProcessing(documentId) {
        return this.request(`/processing/document/${documentId}`);
    }

    async processDocument(documentId, processingData) {
        return this.request(`/processing/document/${documentId}/process`, {
            method: 'POST',
            body: JSON.stringify(processingData)
        });
    }

    async getProcessingQueue(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/processing/queue?${queryString}`);
    }

    // Learning methods
    async trainMappings(data) {
        return this.request('/learning/train', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async suggestMapping(params) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/learning/suggest?${queryString}`);
    }

    async getLearningStats(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/learning/stats?${queryString}`);
    }

    async getMappingSuggestions(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/learning/suggestions?${queryString}`);
    }

    async updateMappingFeedback(mappingId, feedback) {
        return this.request(`/learning/mapping/${mappingId}/feedback`, {
            method: 'POST',
            body: JSON.stringify(feedback)
        });
    }

    async getAllMappings(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/learning/mappings?${queryString}`);
    }
}

// Create global API client instance
const api = new ApiClient();













