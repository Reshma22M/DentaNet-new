// API Base URL
const API_BASE_URL = 'http://localhost:3000/api';

// Helper function to get auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('authToken');
}

// Helper function to get auth headers
function getAuthHeaders() {
    const token = getAuthToken();
    return {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
}

// API Functions
const API = {
    // Authentication
    auth: {
        login: async (email, password) => {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (response.ok && data.token) {
                localStorage.setItem('authToken', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
            }
            return data;
        },

        register: async (userData) => {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            return await response.json();
        },

        logout: () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            window.location.href = '/login.html';
        },

        verify: async () => {
            const response = await fetch(`${API_BASE_URL}/auth/verify`, {
                headers: getAuthHeaders()
            });
            return await response.json();
        }
    },

    // Users
    users: {
        getAll: async () => {
            const response = await fetch(`${API_BASE_URL}/users`, {
                headers: getAuthHeaders()
            });
            return await response.json();
        },

        getById: async (id) => {
            const response = await fetch(`${API_BASE_URL}/users/${id}`, {
                headers: getAuthHeaders()
            });
            return await response.json();
        },

        update: async (id, userData) => {
            const response = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(userData)
            });
            return await response.json();
        },

        delete: async (id) => {
            const response = await fetch(`${API_BASE_URL}/users/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            return await response.json();
        }
    },

    // Lab Bookings
    bookings: {
        getAll: async () => {
            const response = await fetch(`${API_BASE_URL}/bookings`, {
                headers: getAuthHeaders()
            });
            return await response.json();
        },

        create: async (bookingData) => {
            const response = await fetch(`${API_BASE_URL}/bookings`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(bookingData)
            });
            return await response.json();
        },

        updateStatus: async (id, status) => {
            const response = await fetch(`${API_BASE_URL}/bookings/${id}/status`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify({ status })
            });
            return await response.json();
        },

        cancel: async (id) => {
            const response = await fetch(`${API_BASE_URL}/bookings/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            return await response.json();
        }
    },

    // Study Materials
    materials: {
        getAll: async (course_id = null, type = null) => {
            let url = `${API_BASE_URL}/materials?`;
            if (course_id) url += `course_id=${course_id}&`;
            if (type) url += `type=${type}`;
            
            const response = await fetch(url, {
                headers: getAuthHeaders()
            });
            return await response.json();
        },

        upload: async (formData) => {
            const token = getAuthToken();
            const response = await fetch(`${API_BASE_URL}/materials`, {
                method: 'POST',
                headers: {
                    ...(token && { 'Authorization': `Bearer ${token}` })
                },
                body: formData // Don't set Content-Type for FormData
            });
            return await response.json();
        }
    },

    // Notifications
    notifications: {
        getByUser: async (userId) => {
            const response = await fetch(`${API_BASE_URL}/notifications/${userId}`, {
                headers: getAuthHeaders()
            });
            return await response.json();
        },

        markAsRead: async (id) => {
            const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
                method: 'PUT',
                headers: getAuthHeaders()
            });
            return await response.json();
        },

        create: async (notificationData) => {
            const response = await fetch(`${API_BASE_URL}/notifications`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(notificationData)
            });
            return await response.json();
        }
    },

    // Evaluations
    evaluations: {
        getBySubmission: async (submissionId) => {
            const response = await fetch(`${API_BASE_URL}/evaluations/${submissionId}`, {
                headers: getAuthHeaders()
            });
            return await response.json();
        },

        submitAI: async (evaluationData) => {
            const response = await fetch(`${API_BASE_URL}/evaluations/ai`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(evaluationData)
            });
            return await response.json();
        },

        submitLecturer: async (evaluationData) => {
            const response = await fetch(`${API_BASE_URL}/evaluations/lecturer`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(evaluationData)
            });
            return await response.json();
        },

        getAI: async (submissionId) => {
            const response = await fetch(`${API_BASE_URL}/evaluations/ai/${submissionId}`, {
                headers: getAuthHeaders()
            });
            return await response.json();
        }
    }
};

// Check authentication on protected pages
function checkAuth() {
    const token = getAuthToken();
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// Get current user from localStorage
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}
