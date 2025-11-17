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
 * Show admin panel by switching to admin tab
 */
export async function showAdminPanel() {
    const adminCheck = await checkAdminStatus();
    if (!adminCheck) {
        console.warn('User is not an admin');
        return;
    }

    // Switch to admin tab
    const { switchTab } = await import('./tabs.js');
    switchTab('admin');

    // Load initial data
    loadStatsSubtab();
}

/**
 * Switch between admin subtabs
 */
function switchAdminSubtab(subtabName) {
    // Update subtab buttons
    document.querySelectorAll('.admin-subtab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subtab === subtabName);
    });

    // Update subtab content
    document.querySelectorAll('.admin-subtab-content').forEach(content => {
        content.classList.remove('active');
    });

    const targetContent = document.getElementById(`admin${subtabName.charAt(0).toUpperCase() + subtabName.slice(1)}Subtab`);
    targetContent.classList.add('active');

    // Load data for the subtab
    if (subtabName === 'stats') {
        loadStatsSubtab();
    } else if (subtabName === 'users') {
        loadUsersSubtab();
    }
}

/**
 * Load statistics subtab
 */
async function loadStatsSubtab() {
    const statsSubtab = document.getElementById('adminStatsSubtab');
    if (!statsSubtab) return;

    try {
        const stats = await getSystemStats();

        statsSubtab.innerHTML = `
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
        statsSubtab.innerHTML = `
            <div class="error-message">
                Error al cargar estadísticas: ${error.message}
            </div>
        `;
    }
}

/**
 * Load users subtab
 */
async function loadUsersSubtab() {
    const usersSubtab = document.getElementById('adminUsersSubtab');
    if (!usersSubtab) return;

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

        usersSubtab.innerHTML = usersHTML;
    } catch (error) {
        usersSubtab.innerHTML = `
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
        loadUsersSubtab(); // Refresh the table
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
        loadUsersSubtab(); // Refresh the table
    } catch (error) {
        alert('Error al revocar privilegios de admin: ' + error.message);
    }
};

/**
 * Initialize admin features
 * Shows admin tab and dropdown menu item if user is admin
 */
export async function initAdmin() {
    console.log('[initAdmin] Starting admin initialization...');

    // Setup user menu toggle first (needed by admin panel button)
    const userMenuToggle = document.getElementById('userMenuToggle');
    const userDropdown = document.getElementById('userDropdown');

    console.log('[initAdmin] Elements found:', {
        userMenuToggle: !!userMenuToggle,
        userDropdown: !!userDropdown
    });

    if (userMenuToggle && userDropdown) {
        console.log('[initAdmin] Setting up user menu toggle...');

        userMenuToggle.addEventListener('click', (e) => {
            console.log('[initAdmin] User menu toggle clicked');
            e.stopPropagation();
            const isHidden = userDropdown.classList.toggle('hidden');
            // Toggle arrow rotation
            userMenuToggle.classList.toggle('open', !isHidden);
            console.log('[initAdmin] Dropdown is now:', isHidden ? 'hidden' : 'visible');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!userDropdown.contains(e.target) && !userMenuToggle.contains(e.target)) {
                userDropdown.classList.add('hidden');
                userMenuToggle.classList.remove('open');
            }
        });

        console.log('[initAdmin] User menu toggle setup complete');
    } else {
        console.warn('[initAdmin] User menu elements not found!');
    }

    // Check admin status and setup admin features
    console.log('[initAdmin] Checking admin status...');
    const adminCheck = await checkAdminStatus();
    console.log('[initAdmin] Admin status:', adminCheck);

    if (adminCheck) {
        // Show admin tab button
        const adminTabBtn = document.getElementById('adminTabBtn');
        if (adminTabBtn) {
            adminTabBtn.classList.remove('hidden');
        }

        // Show admin button in dropdown menu
        const adminPanelBtn = document.getElementById('adminPanelBtn');
        if (adminPanelBtn) {
            adminPanelBtn.classList.remove('hidden');
            adminPanelBtn.addEventListener('click', () => {
                showAdminPanel();
                // Close dropdown after clicking
                if (userDropdown) {
                    userDropdown.classList.add('hidden');
                }
                if (userMenuToggle) {
                    userMenuToggle.classList.remove('open');
                }
            });
        }

        // Setup admin subtabs
        document.querySelectorAll('.admin-subtab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const subtabName = e.target.getAttribute('data-subtab');
                switchAdminSubtab(subtabName);
            });
        });
    }

    console.log('[initAdmin] Admin initialization complete');
}
