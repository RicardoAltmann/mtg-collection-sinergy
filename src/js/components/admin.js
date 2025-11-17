/**
 * Admin Panel Component
 * Provides administrative functions for managing users and viewing statistics
 */

import { getAuthHeaders } from '../api/supabase.js';

let isAdmin = false;
let adminData = null;

/**
 * Check if current user is an admin
 */
export async function checkAdminStatus() {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/admin/check', { headers });

        if (!response.ok) {
            isAdmin = false;
            return false;
        }

        const data = await response.json();
        isAdmin = data.isAdmin;
        adminData = data;

        return isAdmin;
    } catch (error) {
        console.error('Error checking admin status:', error);
        isAdmin = false;
        return false;
    }
}

/**
 * Get system statistics
 */
export async function getSystemStats() {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/admin/stats', { headers });

        if (!response.ok) {
            throw new Error('Failed to fetch system stats');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching system stats:', error);
        throw error;
    }
}

/**
 * Get all users and their statistics
 */
export async function getAllUsers() {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/admin/users', { headers });

        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

/**
 * Get a specific user's collection
 */
export async function getUserCollection(userId) {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`/api/admin/user/${userId}/collection`, { headers });

        if (!response.ok) {
            throw new Error('Failed to fetch user collection');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching user collection:', error);
        throw error;
    }
}

/**
 * Grant admin privileges to a user
 */
export async function grantAdmin(userId) {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch('/api/admin/grant', {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to grant admin privileges');
        }

        return await response.json();
    } catch (error) {
        console.error('Error granting admin:', error);
        throw error;
    }
}

/**
 * Revoke admin privileges from a user
 */
export async function revokeAdmin(userId) {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`/api/admin/revoke/${userId}`, {
            method: 'DELETE',
            headers
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to revoke admin privileges');
        }

        return await response.json();
    } catch (error) {
        console.error('Error revoking admin:', error);
        throw error;
    }
}

/**
 * Create and show admin panel UI
 */
export async function showAdminPanel() {
    const adminCheck = await checkAdminStatus();
    if (!adminCheck) {
        console.warn('User is not an admin');
        return;
    }

    // Create admin panel container
    const adminPanel = document.createElement('div');
    adminPanel.id = 'admin-panel';
    adminPanel.className = 'admin-panel';

    adminPanel.innerHTML = `
        <div class="admin-header">
            <h2>🛡️ Panel de Administración</h2>
            <button id="close-admin-panel" class="btn-close">✕</button>
        </div>

        <div class="admin-tabs">
            <button class="admin-tab active" data-tab="stats">Estadísticas</button>
            <button class="admin-tab" data-tab="users">Usuarios</button>
        </div>

        <div class="admin-content">
            <div id="admin-stats-tab" class="admin-tab-content active">
                <div class="loading">Cargando estadísticas...</div>
            </div>

            <div id="admin-users-tab" class="admin-tab-content">
                <div class="loading">Cargando usuarios...</div>
            </div>
        </div>
    `;

    document.body.appendChild(adminPanel);

    // Add event listeners
    document.getElementById('close-admin-panel').addEventListener('click', () => {
        adminPanel.remove();
    });

    // Tab switching
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchAdminTab(tabName);
        });
    });

    // Load initial data
    loadStatsTab();
}

/**
 * Switch between admin tabs
 */
function switchAdminTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const targetContent = document.getElementById(`admin-${tabName}-tab`);
    targetContent.classList.add('active');

    // Load data for the tab
    if (tabName === 'stats') {
        loadStatsTab();
    } else if (tabName === 'users') {
        loadUsersTab();
    }
}

/**
 * Load statistics tab
 */
async function loadStatsTab() {
    const statsTab = document.getElementById('admin-stats-tab');

    try {
        const stats = await getSystemStats();

        statsTab.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${stats.totalUsers}</div>
                    <div class="stat-label">Usuarios Totales</div>
                </div>

                <div class="stat-card">
                    <div class="stat-value">${stats.totalCards}</div>
                    <div class="stat-label">Cartas en Colecciones</div>
                </div>

                <div class="stat-card">
                    <div class="stat-value">${stats.uniqueCards}</div>
                    <div class="stat-label">Cartas Únicas</div>
                </div>

                <div class="stat-card">
                    <div class="stat-value">${stats.totalAdmins}</div>
                    <div class="stat-label">Administradores</div>
                </div>

                <div class="stat-card">
                    <div class="stat-value">${stats.averageCardsPerUser}</div>
                    <div class="stat-label">Promedio Cartas/Usuario</div>
                </div>
            </div>
        `;
    } catch (error) {
        statsTab.innerHTML = `
            <div class="error-message">
                Error al cargar estadísticas: ${error.message}
            </div>
        `;
    }
}

/**
 * Load users tab
 */
async function loadUsersTab() {
    const usersTab = document.getElementById('admin-users-tab');

    try {
        const users = await getAllUsers();

        let usersHTML = `
            <div class="users-table-container">
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Cartas</th>
                            <th>Admin</th>
                            <th>Registrado</th>
                            <th>Último Acceso</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        users.forEach(user => {
            const isCurrentUser = user.email === adminData.email;
            const formattedDate = new Date(user.created_at).toLocaleDateString('es-ES');
            const lastSignIn = user.last_sign_in_at
                ? new Date(user.last_sign_in_at).toLocaleDateString('es-ES')
                : 'Nunca';

            usersHTML += `
                <tr>
                    <td>
                        ${user.email}
                        ${isCurrentUser ? '<span class="badge">Tú</span>' : ''}
                    </td>
                    <td>${user.card_count}</td>
                    <td>
                        ${user.is_admin
                            ? '<span class="badge admin-badge">Admin</span>'
                            : '<span class="badge">Usuario</span>'
                        }
                    </td>
                    <td>${formattedDate}</td>
                    <td>${lastSignIn}</td>
                    <td>
                        <button class="btn-small" onclick="viewUserCollection('${user.id}')">
                            Ver Colección
                        </button>
                        ${!isCurrentUser && !user.is_admin
                            ? `<button class="btn-small btn-admin" onclick="makeUserAdmin('${user.id}', '${user.email}')">
                                Hacer Admin
                            </button>`
                            : ''
                        }
                        ${!isCurrentUser && user.is_admin
                            ? `<button class="btn-small btn-danger" onclick="removeUserAdmin('${user.id}', '${user.email}')">
                                Revocar Admin
                            </button>`
                            : ''
                        }
                    </td>
                </tr>
            `;
        });

        usersHTML += `
                    </tbody>
                </table>
            </div>
        `;

        usersTab.innerHTML = usersHTML;
    } catch (error) {
        usersTab.innerHTML = `
            <div class="error-message">
                Error al cargar usuarios: ${error.message}
            </div>
        `;
    }
}

/**
 * View a user's collection
 */
window.viewUserCollection = async function(userId) {
    try {
        const collection = await getUserCollection(userId);

        alert(`Usuario tiene ${collection.totalCards} cartas:\n\n${
            collection.cards.slice(0, 20).map(c => c.name).join('\n')
        }${collection.totalCards > 20 ? '\n...' : ''}`);
    } catch (error) {
        alert('Error al cargar colección: ' + error.message);
    }
};

/**
 * Grant admin to a user
 */
window.makeUserAdmin = async function(userId, email) {
    if (!confirm(`¿Seguro que quieres hacer administrador a ${email}?`)) {
        return;
    }

    try {
        await grantAdmin(userId);
        alert(`${email} ahora es administrador`);
        loadUsersTab(); // Refresh the table
    } catch (error) {
        alert('Error al otorgar privilegios de admin: ' + error.message);
    }
};

/**
 * Revoke admin from a user
 */
window.removeUserAdmin = async function(userId, email) {
    if (!confirm(`¿Seguro que quieres revocar privilegios de admin a ${email}?`)) {
        return;
    }

    try {
        await revokeAdmin(userId);
        alert(`Privilegios de admin revocados para ${email}`);
        loadUsersTab(); // Refresh the table
    } catch (error) {
        alert('Error al revocar privilegios de admin: ' + error.message);
    }
};

/**
 * Initialize admin features
 * Adds admin button to UI if user is admin
 */
export async function initAdmin() {
    const adminCheck = await checkAdminStatus();

    if (adminCheck) {
        // Add admin button to the header
        const header = document.querySelector('header') || document.querySelector('.app-header');
        if (header) {
            const adminButton = document.createElement('button');
            adminButton.id = 'admin-panel-btn';
            adminButton.className = 'btn admin-btn';
            adminButton.innerHTML = '🛡️ Admin';
            adminButton.addEventListener('click', showAdminPanel);

            header.appendChild(adminButton);
        }
    }
}
