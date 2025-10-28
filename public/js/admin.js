// Admin Interface JavaScript

class AdminApp {
    constructor() {
        this.currentPage = 'dashboard';
        this.initializeApp();
    }

    async initializeApp() {
        // Check authentication
        const isAuthenticated = await auth.checkAuthStatus();
        if (!isAuthenticated) {
            window.location.href = '/login.html';
            return;
        }

        // Check admin access
        if (!auth.isAdmin()) {
            this.showError('Admin access required');
            return;
        }

        this.setupEventListeners();
        this.loadDashboardData();
        this.setupPageNavigation();
    }

    setupEventListeners() {
        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            auth.logout();
        });

        // Company search modal
        document.getElementById('search-companies-btn').addEventListener('click', () => {
            this.showCompanySearchModal();
        });

        // Train models button
        document.getElementById('train-models-btn').addEventListener('click', () => {
            this.trainAllModels();
        });

        // Modal close handlers
        document.querySelectorAll('.modal-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal.id);
            });
        });

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });

        document.getElementById('cancel-search-btn').addEventListener('click', () => {
            this.closeModal('company-search-modal');
        });

        document.getElementById('close-document-btn').addEventListener('click', () => {
            this.closeModal('document-viewer-modal');
        });

        document.getElementById('cancel-processing-btn').addEventListener('click', () => {
            this.closeModal('document-processing-modal');
        });

        // Search input
        document.getElementById('company-search-input').addEventListener('input', (e) => {
            this.searchCompanies(e.target.value);
        });
    }

    setupPageNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = link.getAttribute('data-page');
                this.navigateToPage(pageId);
            });
        });
    }

    navigateToPage(pageId) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // Show selected page
        document.getElementById(`${pageId}-page`).classList.add('active');

        // Update active nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

        this.currentPage = pageId;

        // Load page-specific data
        switch (pageId) {
            case 'connections':
                this.loadConnectionsData();
                break;
            case 'documents':
                this.loadDocumentsData();
                break;
            case 'processing':
                this.loadProcessingData();
                break;
            case 'learning':
                this.loadLearningData();
                break;
            case 'mappings':
                this.loadMappingsData();
                break;
        }
    }

    async loadDashboardData() {
        try {
            this.showLoading('dashboard-stats');

            // Load dashboard statistics in parallel
            const [documentStats, connections, processingQueue] = await Promise.all([
                api.getDocumentStats().catch(() => ({ stats: { sent: 0, received: 0, delivered: 0, processed: 0 } })),
                api.getMyConnections().catch(() => ({ connections: [] })),
                api.getProcessingQueue({ limit: 1 }).catch(() => ({ processing_queue: [] }))
            ]);

            // Update document statistics
            document.getElementById('sent-documents').textContent = documentStats.stats?.sent || 0;
            document.getElementById('received-documents').textContent = documentStats.stats?.received || 0;

            // Update active connections count
            const activeConnections = connections.connections?.filter(conn => conn.status === 'approved') || [];
            const totalConnections = connections.connections?.length || 0;

            document.getElementById('active-connections').textContent = `${activeConnections.length}/${totalConnections}`;

            // Update processing queue count
            const queueCount = processingQueue.processing_queue?.length || 0;
            document.getElementById('processing-queue').textContent = queueCount;

            this.hideLoading('dashboard-stats');
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async loadConnectionsData() {
        try {
            this.showLoading('connections-page');

            // Load pending requests
            const pendingRequests = await api.getPendingRequests();
            this.renderPendingRequests(pendingRequests.pending_requests || []);

            // Load active connections
            const connections = await api.getMyConnections();
            this.renderConnections(connections.connections || []);

            this.hideLoading('connections-page');
        } catch (error) {
            console.error('Failed to load connections data:', error);
            this.showError('Failed to load connections data');
        }
    }

    renderPendingRequests(requests) {
        const container = document.getElementById('pending-requests');

        if (requests.length === 0) {
            container.innerHTML = '<p>Geen afwachtende verzoeken</p>';
            return;
        }

        container.innerHTML = requests.map(request => `
            <div class="connection-item">
                <div class="connection-info">
                    <div class="connection-name">${request.initiator_company.name}</div>
                    <div class="connection-details">
                        Business ID: ${request.initiator_company.business_id} |
                        Aangevraagd door: ${request.initiated_by.first_name} ${request.initiated_by.last_name} |
                        ${new Date(request.created_at).toLocaleDateString('nl-NL')}
                    </div>
                </div>
                <div class="connection-actions">
                    <button class="btn-success" onclick="adminApp.approveConnection('${request.id}')">
                        Goedkeuren
                    </button>
                    <button class="btn-danger" onclick="adminApp.declineConnection('${request.id}')">
                        Afwijzen
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderConnections(connections) {
        const container = document.getElementById('active-connections-list');

        if (connections.length === 0) {
            container.innerHTML = '<p>Geen actieve verbindingen</p>';
            return;
        }

        container.innerHTML = connections.map(connection => `
            <div class="connection-item ${connection.status}">
                <div class="connection-info">
                    <div class="connection-name">
                        ${connection.initiator_company.name} ↔ ${connection.target_company.name}
                    </div>
                    <div class="connection-details">
                        Status: ${this.getStatusLabel(connection.status)} |
                        ${connection.approved_at ? `Goedgekeurd: ${new Date(connection.approved_at).toLocaleDateString('nl-NL')}` : ''}
                    </div>
                </div>
                <div class="connection-actions">
                    ${connection.status === 'approved' ? `
                        <button class="btn-warning" onclick="adminApp.suspendConnection('${connection.id}')">
                            Opschorten
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    getStatusLabel(status) {
        const labels = {
            'pending': 'In afwachting',
            'approved': 'Goedgekeurd',
            'declined': 'Afgewezen',
            'suspended': 'Opgeschort'
        };
        return labels[status] || status;
    }

    async approveConnection(connectionId) {
        try {
            await api.approveConnection(connectionId);
            this.showNotification('Verbinding goedgekeurd', 'success');
            this.loadConnectionsData();
        } catch (error) {
            console.error('Failed to approve connection:', error);
            this.showNotification('Fout bij goedkeuren verbinding', 'error');
        }
    }

    async declineConnection(connectionId) {
        try {
            await api.declineConnection(connectionId);
            this.showNotification('Verbinding afgewezen', 'success');
            this.loadConnectionsData();
        } catch (error) {
            console.error('Failed to decline connection:', error);
            this.showNotification('Fout bij afwijzen verbinding', 'error');
        }
    }

    async suspendConnection(connectionId) {
        try {
            await api.suspendConnection(connectionId);
            this.showNotification('Verbinding opgeschort', 'success');
            this.loadConnectionsData();
        } catch (error) {
            console.error('Failed to suspend connection:', error);
            this.showNotification('Fout bij opschorten verbinding', 'error');
        }
    }

    async showCompanySearchModal() {
        const modal = document.getElementById('company-search-modal');
        modal.classList.add('active');

        // Focus search input
        document.getElementById('company-search-input').focus();
    }

    async searchCompanies(searchTerm) {
        try {
            const results = await api.searchCompanies(searchTerm);
            this.renderSearchResults(results.companies || []);
        } catch (error) {
            console.error('Failed to search companies:', error);
            this.showError('Fout bij zoeken bedrijven');
        }
    }

    renderSearchResults(companies) {
        const container = document.getElementById('search-results');

        if (companies.length === 0) {
            container.innerHTML = '<p>Geen bedrijven gevonden</p>';
            return;
        }

        container.innerHTML = companies.map(company => `
            <div class="search-result-item" onclick="adminApp.requestConnection('${company.id}')">
                <div class="search-result-name">${company.name}</div>
                <div class="search-result-details">
                    Business ID: ${company.business_id} |
                    ${company.email_domain ? `Domein: ${company.email_domain}` : ''}
                </div>
            </div>
        `).join('');
    }

    async requestConnection(companyId) {
        try {
            await api.requestConnection(companyId);
            this.showNotification('Verbindingsverzoek verzonden', 'success');

            // Close modal
            document.getElementById('company-search-modal').classList.remove('active');

            // Reload connections data
            this.loadConnectionsData();
        } catch (error) {
            console.error('Failed to request connection:', error);
            this.showNotification('Fout bij verzenden verbindingsverzoek', 'error');
        }
    }

    async loadDocumentsData() {
        try {
            this.showLoading('documents-page');

            // Load sent documents
            const sentDocs = await api.getSentDocuments({ limit: 10 });
            this.renderDocuments('sent-documents-list', sentDocs.documents || []);

            // Load received documents
            const receivedDocs = await api.getReceivedDocuments({ limit: 10 });
            this.renderDocuments('received-documents-list', receivedDocs.documents || []);

            this.hideLoading('documents-page');
        } catch (error) {
            console.error('Failed to load documents data:', error);
            this.showError('Failed to load documents data');
        }
    }

    renderDocuments(containerId, documents) {
        const container = document.getElementById(containerId);

        if (documents.length === 0) {
            container.innerHTML = '<p>Geen documenten</p>';
            return;
        }

        container.innerHTML = documents.map(doc => `
            <div class="document-item ${doc.status}">
                <div class="document-info">
                    <div class="document-name">${doc.original_filename}</div>
                    <div class="document-details">
                        Type: ${doc.document_type} |
                        Grootte: ${this.formatFileSize(doc.file_size)} |
                        ${doc.status === 'sent' ? 'Verzonden' : doc.status === 'delivered' ? 'Bezorgd' : 'Verwerkt'}: ${new Date(doc.sent_at).toLocaleDateString('nl-NL')}
                    </div>
                </div>
                <div class="document-actions">
                    <button class="btn-primary" onclick="adminApp.viewDocument('${doc.id}')">
                        Bekijken
                    </button>
                </div>
            </div>
        `).join('');
    }

    async loadProcessingData() {
        try {
            this.showLoading('processing-page');

            const queue = await api.getProcessingQueue({ limit: 20 });
            this.renderProcessingQueue(queue.processing_queue || []);

            this.hideLoading('processing-page');
        } catch (error) {
            console.error('Failed to load processing data:', error);
            this.showError('Failed to load processing data');
        }
    }

    renderProcessingQueue(documents) {
        const container = document.getElementById('processing-queue-list');

        if (documents.length === 0) {
            container.innerHTML = '<p>Geen documenten om te verwerken</p>';
            return;
        }

        container.innerHTML = documents.map(doc => `
            <div class="processing-item ${doc.priority}">
                <div class="processing-info">
                    <div class="processing-name">${doc.original_filename}</div>
                    <div class="processing-details">
                        Van: ${doc.sender_company_name} |
                        Prioriteit: ${doc.priority} |
                        ${new Date(doc.processed_at).toLocaleDateString('nl-NL')}
                    </div>
                </div>
                <div class="processing-actions">
                    <button class="btn-secondary" onclick="adminApp.viewDocument('${doc.id}')">
                        Bekijken
                    </button>
                    <button class="btn-primary" onclick="adminApp.processDocument('${doc.id}')">
                        Verwerken
                    </button>
                </div>
            </div>
        `).join('');
    }

    async loadLearningData() {
        try {
            this.showLoading('learning-page');

            const stats = await api.getLearningStats();
            this.renderLearningStats(stats.learning_stats || []);

            this.hideLoading('learning-page');
        } catch (error) {
            console.error('Failed to load learning data:', error);
            this.showError('Failed to load learning data');
        }
    }

    renderLearningStats(stats) {
        const container = document.getElementById('learning-statistics');

        if (stats.length === 0) {
            container.innerHTML = '<p>Geen leerstatistieken beschikbaar</p>';
            return;
        }

        container.innerHTML = stats.map(stat => `
            <div class="learning-card">
                <h4>${stat.company_name}</h4>
                <div class="stat-row">
                    <span>Totale mappings:</span>
                    <strong>${stat.stats.total_mappings || 0}</strong>
                </div>
                <div class="stat-row">
                    <span>Gemiddelde betrouwbaarheid:</span>
                    <strong>${((stat.stats.avg_confidence || 0) * 100).toFixed(1)}%</strong>
                </div>
                <div class="stat-row">
                    <span>Leerprogressie:</span>
                    <strong>${((stat.stats.learning_progress || 0) * 100).toFixed(1)}%</strong>
                </div>
                <div class="confidence-meter">
                    <span>Betrouwbaarheidsverdeling:</span>
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${((stat.stats.confidence_distribution?.high || 0) / (stat.stats.total_mappings || 1)) * 100}%"></div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async loadMappingsData() {
        try {
            this.showLoading('mappings-page');

            const mappings = await api.getAllMappings({ limit: 50 });
            this.renderMappings(mappings.mappings || []);

            this.hideLoading('mappings-page');
        } catch (error) {
            console.error('Failed to load mappings data:', error);
            this.showError('Failed to load mappings data');
        }
    }

    renderMappings(mappingsData) {
        const container = document.getElementById('mappings-list');

        if (mappingsData.length === 0) {
            container.innerHTML = '<p>Geen mappings beschikbaar</p>';
            return;
        }

        container.innerHTML = mappingsData.map(data => `
            <div class="mapping-section">
                <h4>${data.company_name}</h4>
                ${data.mappings.map(mapping => `
                    <div class="mapping-item">
                        <div class="mapping-info">
                            <div class="mapping-name">${mapping.from_product_code} → ${mapping.to_product_code}</div>
                            <div class="mapping-details">
                                Betrouwbaarheid: ${mapping.confidence_score ? (mapping.confidence_score * 100).toFixed(1) + '%' : 'Onbekend'} |
                                Gebruik: ${mapping.usage_count || 0} keer
                            </div>
                        </div>
                        <div class="mapping-actions">
                            <span class="mapping-confidence confidence-${this.getConfidenceLevel(mapping.confidence_score)}">
                                ${this.getConfidenceLabel(mapping.confidence_score)}
                            </span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');
    }

    getConfidenceLevel(confidence) {
        if (confidence >= 0.8) return 'high';
        if (confidence >= 0.5) return 'medium';
        return 'low';
    }

    getConfidenceLabel(confidence) {
        if (confidence >= 0.8) return 'Hoog';
        if (confidence >= 0.5) return 'Gemiddeld';
        return 'Laag';
    }

    async trainAllModels() {
        try {
            this.showNotification('Model training gestart...', 'info');

            // Get all connections
            const connections = await api.getMyConnections();

            for (const connection of connections.connections || []) {
                if (connection.status === 'approved') {
                    try {
                        await api.trainMappings({
                            to_company_id: connection.initiator_company_id === auth.getCurrentUser().company_id
                                ? connection.target_company_id
                                : connection.initiator_company_id
                        });
                    } catch (error) {
                        console.error(`Failed to train model for connection ${connection.id}:`, error);
                    }
                }
            }

            this.showNotification('Model training voltooid', 'success');
            this.loadLearningData();

        } catch (error) {
            console.error('Failed to train models:', error);
            this.showNotification('Fout bij model training', 'error');
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = '<div class="loading">Laden...</div>';
        }
    }

    hideLoading(elementId) {
        // Loading indicators are handled by the rendering functions
    }

    showNotification(message, type = 'info') {
        auth.showNotification(message, type);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    // Document viewer implementation
    async viewDocument(documentId) {
        try {
            this.currentDocumentId = documentId; // Store current document ID
            this.showLoading('document-viewer-modal');

            // Fetch document details
            const document = await api.getDocument(documentId);

            // Populate modal with document data
            this.populateDocumentViewer(document);

            // Show modal
            this.showModal('document-viewer-modal');

            this.hideLoading('document-viewer-modal');
        } catch (error) {
            console.error('Failed to load document:', error);
            this.showError('Failed to load document details');
        }
    }

    populateDocumentViewer(document) {
        // Set title
        document.getElementById('document-viewer-title').textContent =
            `Document: ${document.document.original_filename}`;

        // Set document info
        document.getElementById('document-type').textContent =
            document.document.document_type || 'N/A';
        document.getElementById('document-sender').textContent =
            document.document.sender_company_name || 'N/A';
        document.getElementById('document-date').textContent =
            new Date(document.document.sent_at).toLocaleString('nl-NL');
        document.getElementById('document-size').textContent =
            this.formatFileSize(document.document.file_size);
        document.getElementById('document-priority').textContent =
            document.document.priority || 'Normal';

        // Set up event listeners
        document.getElementById('download-document-btn').onclick = () =>
            api.downloadDocument(this.currentDocumentId);
        document.getElementById('acknowledge-document-btn').onclick = async () => {
            try {
                await api.acknowledgeDocument(this.currentDocumentId);
                this.showNotification('Document bevestigd', 'success');
                this.closeModal('document-viewer-modal');
                this.loadDocumentsData(); // Refresh document list
            } catch (error) {
                this.showError('Failed to acknowledge document');
            }
        };

        // Set up tabs
        this.setupDocumentTabs();

        // Populate tabs content
        this.populateDocumentDetails(document);
        this.populateExtractedContent(document);
        this.populateRecipients(document);
    }

    setupDocumentTabs() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;

                // Remove active class from all tabs
                document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

                // Add active class to clicked tab
                e.target.classList.add('active');
                document.getElementById(`${tabName}-tab`).classList.add('active');
            });
        });
    }

    populateDocumentDetails(document) {
        const detailsDiv = document.getElementById('document-details');
        const doc = document.document;

        detailsDiv.innerHTML = `
            <div class="field-item">
                <div class="field-name">Bestandsnaam</div>
                <div class="field-value">${doc.original_filename}</div>
            </div>
            <div class="field-item">
                <div class="field-name">MIME Type</div>
                <div class="field-value">${doc.mime_type}</div>
            </div>
            <div class="field-item">
                <div class="field-name">Status</div>
                <div class="field-value">
                    <span class="status-badge status-${doc.status}">${doc.status}</span>
                </div>
            </div>
            <div class="field-item">
                <div class="field-name">Verzonden</div>
                <div class="field-value">${new Date(doc.sent_at).toLocaleString('nl-NL')}</div>
            </div>
            ${doc.delivered_at ? `
                <div class="field-item">
                    <div class="field-name">Geleverd</div>
                    <div class="field-value">${new Date(doc.delivered_at).toLocaleString('nl-NL')}</div>
                </div>
            ` : ''}
            ${doc.processed_at ? `
                <div class="field-item">
                    <div class="field-name">Verwerkt</div>
                    <div class="field-value">${new Date(doc.processed_at).toLocaleString('nl-NL')}</div>
                </div>
            ` : ''}
        `;
    }

    populateExtractedContent(document) {
        const contentDiv = document.getElementById('extracted-fields');
        const content = document.content || [];

        if (content.length === 0) {
            contentDiv.innerHTML = '<p>Geen geëxtraheerde gegevens beschikbaar</p>';
            return;
        }

        contentDiv.innerHTML = content.map(field => {
            const confidenceClass = this.getConfidenceClass(field.confidence_score);
            return `
                <div class="field-item">
                    <div class="field-name">${field.field_name}</div>
                    <div class="field-value">${field.field_value}</div>
                    <div class="confidence ${confidenceClass}">
                        Confidence: ${(field.confidence_score * 100).toFixed(1)}%
                    </div>
                </div>
            `;
        }).join('');
    }

    populateRecipients(document) {
        const recipientsDiv = document.getElementById('document-recipients');
        const recipients = document.document.recipients || [];

        if (recipients.length === 0) {
            recipientsDiv.innerHTML = '<p>Geen specifieke ontvangers</p>';
            return;
        }

        recipientsDiv.innerHTML = recipients.map(recipient => `
            <div class="recipient-item">
                <div class="recipient-info">
                    <div class="recipient-name">${recipient.first_name} ${recipient.last_name}</div>
                    <div class="recipient-email">${recipient.email}</div>
                </div>
                <div class="recipient-status ${recipient.is_acknowledged ? 'acknowledged' : 'pending'}">
                    ${recipient.is_acknowledged ? 'Bevestigd' : 'In afwachting'}
                    ${recipient.acknowledged_at ? ` (${new Date(recipient.acknowledged_at).toLocaleDateString('nl-NL')})` : ''}
                </div>
            </div>
        `).join('');
    }

    getConfidenceClass(confidence) {
        if (confidence >= 0.8) return 'high';
        if (confidence >= 0.5) return 'medium';
        return 'low';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Modal management
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';

            // Focus first focusable element
            const firstFocusable = modal.querySelector('input, button, [tabindex]:not([tabindex="-1"])');
            if (firstFocusable) {
                firstFocusable.focus();
            }
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    showCompanySearchModal() {
        this.showModal('company-search-modal');
        document.getElementById('company-search-input').focus();
    }

    // Document processing interface implementation
    async processDocument(documentId) {
        try {
            this.currentDocumentId = documentId;
            this.showLoading('document-processing-modal');

            // Fetch document for processing
            const processingData = await api.getDocumentForProcessing(documentId);

            // Populate processing modal
            this.populateProcessingInterface(processingData);

            // Show modal
            this.showModal('document-processing-modal');

            this.hideLoading('document-processing-modal');
        } catch (error) {
            console.error('Failed to load document for processing:', error);
            this.showError('Failed to load document for processing');
        }
    }

    populateProcessingInterface(data) {
        const doc = data.document;

        // Set title and info
        document.getElementById('processing-title').textContent =
            `Verwerken: ${doc.original_filename}`;
        document.getElementById('processing-document-name').textContent =
            doc.original_filename;
        document.getElementById('processing-sender').textContent =
            doc.sender_company_name;
        document.getElementById('processing-type').textContent =
            doc.document_type;

        // Set up event listeners
        this.setupProcessingEventListeners();

        // Set up tabs
        this.setupProcessingTabs();

        // Populate content
        this.populateFieldMappings(data);
        this.populateMappingSuggestions(data);
        this.populateProcessingPreview(data);
    }

    setupProcessingEventListeners() {
        // Save mappings button
        document.getElementById('save-mappings-btn').onclick = () =>
            this.saveMappings(false);

        // Apply and create records button
        document.getElementById('apply-mappings-btn').onclick = () =>
            this.saveMappings(true);

        // Cancel button
        document.getElementById('cancel-processing-btn').onclick = () =>
            this.closeModal('document-processing-modal');

        // Save draft button
        document.getElementById('save-draft-btn').onclick = () =>
            this.saveMappings(false);

        // Real-time preview updates
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('field-input')) {
                this.updateProcessingPreview();
            }
        });
    }

    setupProcessingTabs() {
        const tabButtons = document.querySelectorAll('#document-processing-modal .tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;

                // Remove active class from all tabs in processing modal
                document.querySelectorAll('#document-processing-modal .tab-btn').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('#document-processing-modal .tab-content').forEach(t => t.classList.remove('active'));

                // Add active class to clicked tab
                e.target.classList.add('active');
                document.getElementById(`${tabName}-tab`).classList.add('active');
            });
        });
    }

    populateFieldMappings(data) {
        const mappingsDiv = document.getElementById('field-mappings');
        const content = data.document.content || [];

        if (content.length === 0) {
            mappingsDiv.innerHTML = '<p>Geen velden om te mappen</p>';
            return;
        }

        mappingsDiv.innerHTML = content.map(field => {
            const suggestedMapping = data.document.suggested_mapping || '';
            const mappingConfidence = data.document.mapping_confidence || 0;

            return `
                <div class="mapping-item">
                    <div class="mapping-field">
                        <div style="width: 150px; font-weight: 600;">
                            ${field.field_name}
                            ${field.is_verified ? '<span class="verified-badge">Geverifieerd</span>' : ''}
                        </div>
                        <input type="text" class="field-input"
                               value="${field.field_value}"
                               data-original="${field.field_value}"
                               data-field="${field.field_name}"
                               placeholder="Originele waarde">
                        <div style="width: 120px; text-align: center;">
                            <small class="confidence ${this.getConfidenceClass(field.confidence_score)}">
                                ${(field.confidence_score * 100).toFixed(1)}%
                            </small>
                        </div>
                    </div>
                    ${suggestedMapping ? `
                        <div class="suggestion-item" onclick="adminApp.applySuggestion('${field.field_name}', '${suggestedMapping}')">
                            <div class="suggestion-info">
                                <span>Suggestie: ${suggestedMapping}</span>
                                <span class="suggestion-confidence">
                                    ${Math.round(mappingConfidence * 100)}% match
                                </span>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    populateMappingSuggestions(data) {
        const suggestionsDiv = document.getElementById('mapping-suggestions');
        const suggestions = data.document.suggested_mappings || [];

        if (suggestions.length === 0) {
            suggestionsDiv.innerHTML = '<p>Geen mapping suggesties beschikbaar</p>';
            return;
        }

        suggestionsDiv.innerHTML = suggestions.map(suggestion => `
            <div class="suggestion-item" onclick="adminApp.applySuggestion('${suggestion.field_name}', '${suggestion.suggested_value}')">
                <div class="suggestion-info">
                    <div>
                        <strong>${suggestion.field_name}</strong>: ${suggestion.original_value}
                        <span style="color: #6c757d;"> → </span>
                        <strong>${suggestion.suggested_value}</strong>
                    </div>
                    <span class="suggestion-confidence">
                        ${Math.round(suggestion.confidence * 100)}% zeker
                    </span>
                </div>
            </div>
        `).join('');
    }

    populateProcessingPreview(data) {
        this.updateProcessingPreview();
    }

    updateProcessingPreview() {
        const previewDiv = document.getElementById('processing-preview-content');
        const inputs = document.querySelectorAll('#field-mappings .field-input');

        if (inputs.length === 0) {
            previewDiv.innerHTML = 'Geen preview beschikbaar';
            return;
        }

        const preview = Array.from(inputs).map(input => {
            const fieldName = input.dataset.field;
            const mappedValue = input.value;
            return `${fieldName}: ${mappedValue}`;
        }).join('\n');

        previewDiv.innerHTML = `<pre>${preview}</pre>`;
    }

    applySuggestion(fieldName, suggestedValue) {
        const input = document.querySelector(`[data-field="${fieldName}"]`);
        if (input) {
            input.value = suggestedValue;
            input.focus();
            this.showNotification(`Suggestie toegepast voor ${fieldName}`, 'success');
        }
    }

    async saveMappings(createRecords = false) {
        try {
            const mappings = [];
            const inputs = document.querySelectorAll('#field-mappings .field-input');

            inputs.forEach(input => {
                const originalValue = input.dataset.original;
                const mappedValue = input.value;
                const fieldName = input.dataset.field;

                if (originalValue !== mappedValue) {
                    mappings.push({
                        field_name: fieldName,
                        original_value: originalValue,
                        mapped_value: mappedValue,
                        confidence_score: 1.0
                    });
                }
            });

            if (mappings.length === 0) {
                this.showNotification('Geen wijzigingen om op te slaan', 'info');
                return;
            }

            // Send to API
            await api.processDocument(this.currentDocumentId, {
                mappings,
                create_records: createRecords
            });

            this.showNotification(
                createRecords ? 'Document verwerkt en records gemaakt' : 'Mappings opgeslagen',
                'success'
            );

            this.closeModal('document-processing-modal');
            this.loadDocumentsData(); // Refresh document list

        } catch (error) {
            console.error('Failed to save mappings:', error);
            this.showError('Failed to save mappings');
        }
    }
}

// Create global admin app instance
const adminApp = new AdminApp();













