// Authentication Management

class AuthManager {
    constructor() {
        this.checkAuthStatus();
    }

    async checkAuthStatus() {
        const token = localStorage.getItem('access_token');
        
        // If no token and not on login/auth pages, redirect to login
        const currentPath = window.location.pathname;
        const isAuthPage = currentPath.includes('login') || 
                          currentPath.includes('reset-password') || 
                          currentPath.includes('forgot-password');
        
        if (!token) {
            if (!isAuthPage) {
                console.log('No authentication token found, redirecting to login...');
                window.location.href = '/login.html';
            }
            return false;
        }
        
        // Validate token
        try {
            const user = await api.getCurrentUser();
            this.setAuthenticatedUser(user.user);
            return true;
        } catch (error) {
            console.error('Token validation failed:', error);
            this.logout();
            return false;
        }
    }

    async login(email, password) {
        try {
            const response = await api.login({ email, password });

            this.setAuthenticatedUser(response.user);
            this.showNotification('Successfully logged in!', 'success');

            // Redirect to main app
            this.redirectToApp();

            return response;
        } catch (error) {
            console.error('Login failed:', error);
            this.showNotification(error.message, 'error');
            throw error;
        }
    }

    async register(userData) {
        try {
            const response = await api.register(userData);

            this.setAuthenticatedUser(response.user);
            this.showNotification('Account created successfully!', 'success');

            // Redirect to main app
            this.redirectToApp();

            return response;
        } catch (error) {
            console.error('Registration failed:', error);
            this.showNotification(error.message, 'error');
            throw error;
        }
    }

    logout() {
        api.removeToken();
        localStorage.removeItem('refresh_token');
        this.clearUserInterface();

        // Redirect to login page
        window.location.href = '/login.html';
    }

    setAuthenticatedUser(user) {
        // Store user data
        localStorage.setItem('user', JSON.stringify(user));

        // Update UI
        document.getElementById('user-name').textContent =
            `${user.first_name} ${user.last_name}`;

        // Show admin features if user is admin
        if (user.is_admin) {
            this.showAdminFeatures();
        }
    }

    clearUserInterface() {
        document.getElementById('user-name').textContent = '';
        this.hideAdminFeatures();
    }

    showAdminFeatures() {
        // Show admin-only navigation items
        const adminNavItems = document.querySelectorAll('.admin-only');
        adminNavItems.forEach(item => item.style.display = 'block');
    }

    hideAdminFeatures() {
        // Hide admin-only navigation items
        const adminNavItems = document.querySelectorAll('.admin-only');
        adminNavItems.forEach(item => item.style.display = 'none');
    }

    redirectToApp() {
        // Redirect to main application
        if (window.location.pathname.includes('login.html') ||
            window.location.pathname === '/') {
            window.location.href = '/';
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);

        // Hide after 5 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 5000);
    }

    isAuthenticated() {
        return !!localStorage.getItem('access_token');
    }

    isAdmin() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.is_admin === true;
    }

    getCurrentUser() {
        return JSON.parse(localStorage.getItem('user') || '{}');
    }
}

// Create global auth manager instance
const auth = new AuthManager();

// Auto-logout on token expiry
setInterval(async () => {
    if (auth.isAuthenticated()) {
        try {
            await api.getCurrentUser();
        } catch (error) {
            console.log('Token expired, logging out...');
            auth.logout();
        }
    }
}, 60000); // Check every minute

















