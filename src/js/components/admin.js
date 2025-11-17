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
        console.log('[checkAdminStatus] Headers:', headers);

        const response = await fetch('/api/admin/check', { headers });
        console.log('[checkAdminStatus] Response status:', response.status, response.ok);

        if (!response.ok) {
            console.warn('[checkAdminStatus] Response not OK:', response.status, response.statusText);
            isAdmin = false;
            return false;
        }

        const data = await response.json();
        console.log('[checkAdminStatus] Response data:', data);

        isAdmin = data.isAdmin;
        adminData = data;

        console.log('[checkAdminStatus] isAdmin set to:', isAdmin);
        return isAdmin;
    } catch (error) {
        console.error('[checkAdminStatus] Error checking admin status:', error);
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
 * Update a user's card limit
 */
export async function updateUserLimit(userId, maxCards, reason = null) {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`/api/admin/users/${userId}/limit`, {
            method: 'PUT',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                max_cards: maxCards,
                reason: reason
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update user limit');
        }

        return await response.json();
    } catch (error) {
        console.error('Error updating user limit:', error);
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

        // Check if we have storage savings data
        const hasStorageData = stats.storage && stats.storage.savings_percentage;

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

            ${hasStorageData ? `
                <div class="storage-savings-section">
                    <h3 style="color: #27ae60; margin: 30px 0 20px;">💾 Ahorro de Espacio (Esquema Normalizado)</h3>
                    <div class="stats-grid">
                        <div class="stat-card success">
                            <div class="stat-value">${stats.storage.savings_percentage}%</div>
                            <div class="stat-label">Ahorro de Espacio</div>
                        </div>

                        <div class="stat-card">
                            <div class="stat-value">${stats.storage.old_schema_mb} MB</div>
                            <div class="stat-label">Esquema Antiguo (duplicado)</div>
                        </div>

                        <div class="stat-card success">
                            <div class="stat-value">${stats.storage.new_schema_mb} MB</div>
                            <div class="stat-label">Esquema Actual (normalizado)</div>
                        </div>

                        <div class="stat-card success">
                            <div class="stat-value">${stats.storage.savings_mb} MB</div>
                            <div class="stat-label">Espacio Ahorrado</div>
                        </div>
                    </div>
                </div>
            ` : ''}
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
                            <th>Límite</th>
                            <th>Uso</th>
                            <th>Admin</th>
                            <th>Registrado</th>
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

            // Determine usage color
            let usageClass = '';
            if (user.usage_percentage >= 100) {
                usageClass = 'text-danger';
            } else if (user.usage_percentage >= 80) {
                usageClass = 'text-warning';
            }

            const hasCustomLimit = user.has_custom_limit ? '⭐' : '';

            usersHTML += `
                <tr>
                    <td>
                        ${user.email}
                        ${isCurrentUser ? '<span class="badge">Tú</span>' : ''}
                    </td>
                    <td>${user.card_count}</td>
                    <td>
                        ${user.max_cards} ${hasCustomLimit}
                        ${user.custom_limit_reason ? `<br><small style="color: #95a5a6;">${user.custom_limit_reason}</small>` : ''}
                    </td>
                    <td class="${usageClass}">
                        <strong>${user.usage_percentage}%</strong>
                        ${user.usage_percentage >= 100 ? '🚫' : user.usage_percentage >= 80 ? '⚠️' : ''}
                    </td>
                    <td>
                        ${user.is_admin
                            ? '<span class="badge admin-badge">Admin</span>'
                            : '<span class="badge">Usuario</span>'
                        }
                    </td>
                    <td>${formattedDate}</td>
                    <td>
                        <button class="btn-small" onclick="viewUserCollection('${user.id}')">
                            Ver Colección
                        </button>
                        <button class="btn-small" onclick="editUserLimit('${user.id}', '${user.email}', ${user.max_cards}, '${user.custom_limit_reason || ''}')">
                            Editar Límite
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
 * Edit a user's card limit
 */
window.editUserLimit = async function(userId, email, currentLimit, currentReason) {
    const newLimit = prompt(
        `Editar límite de cartas para ${email}\n\nLímite actual: ${currentLimit} cartas\n\nIngresa el nuevo límite (1-50000):`,
        currentLimit
    );

    if (newLimit === null) return; // User canceled

    const limitNumber = parseInt(newLimit);

    if (isNaN(limitNumber) || limitNumber < 1 || limitNumber > 50000) {
        alert('Límite inválido. Debe ser un número entre 1 y 50,000.');
        return;
    }

    const reason = prompt(
        `Razón para el límite personalizado (opcional):\n\nEjemplos: "Usuario premium", "Beta tester", "Coleccionista activo"`,
        currentReason || ''
    );

    try {
        await updateUserLimit(userId, limitNumber, reason || null);
        alert(`Límite actualizado para ${email}:\n- Nuevo límite: ${limitNumber} cartas\n${reason ? `- Razón: ${reason}` : ''}`);
        loadUsersSubtab(); // Refresh the table
    } catch (error) {
        alert('Error al actualizar límite: ' + error.message);
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
        if (!userMenuToggle.dataset.toggleBound) {
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

            userMenuToggle.dataset.toggleBound = 'true';
            userDropdown.dataset.outsideHandlerBound = 'true';
            console.log('[initAdmin] User menu toggle setup complete');
        } else {
            console.log('[initAdmin] User menu toggle already initialized, skipping listener setup');
        }
    } else {
        console.warn('[initAdmin] User menu elements not found!');
    }

    // Check admin status and setup admin features
    console.log('[initAdmin] Checking admin status...');
    const adminCheck = await checkAdminStatus();
    console.log('[initAdmin] Admin status:', adminCheck);

    if (adminCheck) {
        console.log('[initAdmin] ✅ User is admin! Showing admin UI elements...');

        // Show admin tab button
        const adminTabBtn = document.getElementById('adminTabBtn');
        console.log('[initAdmin] adminTabBtn element:', adminTabBtn);
        if (adminTabBtn) {
            console.log('[initAdmin] Removing hidden class from adminTabBtn');
            adminTabBtn.classList.remove('hidden');
        } else {
            console.error('[initAdmin] ❌ adminTabBtn element not found!');
        }

        // Show admin button in dropdown menu
        const adminPanelBtn = document.getElementById('adminPanelBtn');
        console.log('[initAdmin] adminPanelBtn element:', adminPanelBtn);
        if (adminPanelBtn) {
            console.log('[initAdmin] Removing hidden class from adminPanelBtn');
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
        } else {
            console.error('[initAdmin] ❌ adminPanelBtn element not found!');
        }

        // Setup admin subtabs
        document.querySelectorAll('.admin-subtab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const subtabName = e.target.getAttribute('data-subtab');
                switchAdminSubtab(subtabName);
            });
        });
    } else {
        console.log('[initAdmin] ❌ User is NOT admin (adminCheck returned false)');
    }

    console.log('[initAdmin] Admin initialization complete');
}
