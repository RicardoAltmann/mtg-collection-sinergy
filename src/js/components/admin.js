/**
 * Admin Panel Component
 * Provides administrative functions for managing users and viewing statistics
 */

import { getAuthHeaders } from '../api/supabase.js';

let isAdmin = false;
let adminData = null;
let allUsersCache = [];
let currentCollectionUserId = null;
let currentCollectionData = null;
let currentCollectionPage = 0;
let currentEditLimitUserId = null;

const ITEMS_PER_PAGE = 50;

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

        const users = await response.json();
        allUsersCache = users;
        return users;
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    }
}

/**
 * Get a specific user's collection with pagination
 */
export async function getUserCollection(userId, limit = 100, offset = 0) {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`/api/admin/user/${userId}/collection?limit=${limit}&offset=${offset}`, { headers });

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
 * Get audit logs
 */
export async function getAuditLogs(limit = 100, offset = 0) {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`/api/admin/audit-logs?limit=${limit}&offset=${offset}`, { headers });

        if (!response.ok) {
            throw new Error('Failed to fetch audit logs');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching audit logs:', error);
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
    } else if (subtabName === 'history') {
        loadHistorySubtab();
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
                    <h3 style="color: #27ae60; margin: 30px 0 20px;">Ahorro de Espacio (Esquema Normalizado)</h3>
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
 * Load users subtab with search and filters
 */
async function loadUsersSubtab() {
    const usersSubtab = document.getElementById('adminUsersSubtab');
    if (!usersSubtab) return;

    try {
        const users = await getAllUsers();
        renderUsersTable(users);
    } catch (error) {
        usersSubtab.innerHTML = `
            <div class="error-message">
                Error al cargar usuarios: ${error.message}
            </div>
        `;
    }
}

/**
 * Load history subtab with audit logs
 */
async function loadHistorySubtab() {
    const historySubtab = document.getElementById('adminHistorySubtab');
    if (!historySubtab) return;

    try {
        const data = await getAuditLogs(100, 0);

        if (!data.logs || data.logs.length === 0) {
            historySubtab.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <p>No hay acciones registradas aún</p>
                </div>
            `;
            return;
        }

        let historyHTML = `
            <div style="margin-bottom: 15px; color: var(--text-muted);">
                Mostrando ${data.logs.length} acciones recientes
            </div>
            <div class="users-table-container">
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Admin</th>
                            <th>Acción</th>
                            <th>Usuario Afectado</th>
                            <th>Detalles</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.logs.forEach(log => {
            const date = new Date(log.created_at).toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const actionLabels = {
                'GRANT_ADMIN': '<span style="color: #9b59b6;">Otorgar Admin</span>',
                'REVOKE_ADMIN': '<span style="color: #e74c3c;">Revocar Admin</span>',
                'UPDATE_LIMIT': '<span style="color: #3498db;">Actualizar Límite</span>'
            };

            const actionLabel = actionLabels[log.action] || log.action;

            let details = '';
            if (log.details) {
                if (log.details.new_limit) {
                    details = `Nuevo límite: ${log.details.new_limit}`;
                    if (log.details.reason) {
                        details += ` (${log.details.reason})`;
                    }
                }
            }

            historyHTML += `
                <tr>
                    <td>${date}</td>
                    <td>${log.admin_email}</td>
                    <td>${actionLabel}</td>
                    <td>${log.target_email || '-'}</td>
                    <td style="font-size: 0.85em; color: var(--text-muted);">${details || '-'}</td>
                </tr>
            `;
        });

        historyHTML += `
                    </tbody>
                </table>
            </div>
        `;

        historySubtab.innerHTML = historyHTML;
    } catch (error) {
        historySubtab.innerHTML = `
            <div class="error-message">
                Error al cargar historial: ${error.message}
            </div>
        `;
    }
}

/**
 * Render users table with filters
 */
function renderUsersTable(users) {
    const usersSubtab = document.getElementById('adminUsersSubtab');
    if (!usersSubtab) return;

    let usersHTML = `
        <div class="users-filter-bar">
            <div class="input-group">
                <input type="text" id="adminUserSearch" placeholder="Buscar por email..." oninput="filterUsers()">
            </div>
            <select id="adminUserFilter" onchange="filterUsers()">
                <option value="all">Todos los usuarios</option>
                <option value="recent">Registrados hoy</option>
                <option value="week">Últimos 7 días</option>
                <option value="admins">Solo administradores</option>
                <option value="high_usage">Uso > 80%</option>
                <option value="at_limit">En el límite</option>
                <option value="no_cards">Sin cartas</option>
            </select>
            <button class="btn-export" onclick="exportUsersCSV()">📥 Exportar</button>
        </div>

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
                <tbody id="usersTableBody">
    `;

    usersHTML += renderUserRows(users);

    usersHTML += `
                </tbody>
            </table>
        </div>
        <div id="usersTableInfo" style="text-align: center; margin-top: 15px; color: var(--text-muted);">
            Mostrando ${users.length} usuarios
        </div>
    `;

    usersSubtab.innerHTML = usersHTML;
}

/**
 * Render user table rows
 */
function renderUserRows(users) {
    let rowsHTML = '';

    users.forEach(user => {
        const isCurrentUser = user.email === adminData.email;
        const formattedDate = new Date(user.created_at).toLocaleDateString('es-ES');

        // Determine usage color
        let usageClass = '';
        if (user.usage_percentage >= 100) {
            usageClass = 'text-danger';
        } else if (user.usage_percentage >= 80) {
            usageClass = 'text-warning';
        }

        const hasCustomLimit = user.has_custom_limit ? ' *' : '';

        rowsHTML += `
            <tr>
                <td>
                    ${user.email}
                    ${isCurrentUser ? '<span class="badge">Tú</span>' : ''}
                </td>
                <td>${user.card_count}</td>
                <td>
                    ${user.max_cards}${hasCustomLimit}
                    ${user.custom_limit_reason ? `<br><small style="color: #95a5a6;">${user.custom_limit_reason}</small>` : ''}
                </td>
                <td class="${usageClass}">
                    <strong>${user.usage_percentage}%</strong>
                    ${user.usage_percentage >= 100 ? ' !' : user.usage_percentage >= 80 ? ' !' : ''}
                </td>
                <td>
                    ${user.is_admin
                        ? '<span class="badge admin-badge">Admin</span>'
                        : '<span class="badge">Usuario</span>'
                    }
                </td>
                <td>${formattedDate}</td>
                <td>
                    <button class="btn-small" onclick="viewUserCollection('${user.id}', '${user.email}')">
                        Ver
                    </button>
                    <button class="btn-small" onclick="editUserLimit('${user.id}', '${user.email}', ${user.max_cards}, '${user.custom_limit_reason || ''}')">
                        Límite
                    </button>
                    ${!isCurrentUser && !user.is_admin
                        ? `<button class="btn-small btn-admin" onclick="makeUserAdmin('${user.id}', '${user.email}')">
                            +Admin
                        </button>`
                        : ''
                    }
                    ${!isCurrentUser && user.is_admin
                        ? `<button class="btn-small btn-danger" onclick="removeUserAdmin('${user.id}', '${user.email}')">
                            -Admin
                        </button>`
                        : ''
                    }
                </td>
            </tr>
        `;
    });

    return rowsHTML;
}

/**
 * Filter users based on search and filter criteria
 */
window.filterUsers = function() {
    const searchTerm = document.getElementById('adminUserSearch')?.value.toLowerCase() || '';
    const filterType = document.getElementById('adminUserFilter')?.value || 'all';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    let filteredUsers = allUsersCache.filter(user => {
        // Search filter
        if (searchTerm && !user.email.toLowerCase().includes(searchTerm)) {
            return false;
        }

        // Type filter
        const createdAt = new Date(user.created_at);
        switch (filterType) {
            case 'recent':
                return createdAt >= today;
            case 'week':
                return createdAt >= weekAgo;
            case 'admins':
                return user.is_admin;
            case 'high_usage':
                return user.usage_percentage >= 80;
            case 'at_limit':
                return user.usage_percentage >= 100;
            case 'no_cards':
                return user.card_count === 0;
            default:
                return true;
        }
    });

    // Update table body
    const tbody = document.getElementById('usersTableBody');
    if (tbody) {
        tbody.innerHTML = renderUserRows(filteredUsers);
    }

    // Update info
    const info = document.getElementById('usersTableInfo');
    if (info) {
        info.textContent = `Mostrando ${filteredUsers.length} de ${allUsersCache.length} usuarios`;
    }
};

/**
 * Export users to CSV
 */
window.exportUsersCSV = function() {
    const searchTerm = document.getElementById('adminUserSearch')?.value.toLowerCase() || '';
    const filterType = document.getElementById('adminUserFilter')?.value || 'all';

    let users = allUsersCache;
    if (searchTerm || filterType !== 'all') {
        // Apply same filters as display
        window.filterUsers();
        // Get filtered users based on current display
    }

    const headers = ['Email', 'Cartas', 'Límite', 'Uso %', 'Admin', 'Registrado', 'Razón Límite'];
    const rows = users.map(u => [
        u.email,
        u.card_count,
        u.max_cards,
        u.usage_percentage,
        u.is_admin ? 'Sí' : 'No',
        new Date(u.created_at).toLocaleDateString('es-ES'),
        u.custom_limit_reason || ''
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    downloadCSV(csv, 'usuarios_mtg.csv');
};

/**
 * View a user's collection in modal
 */
window.viewUserCollection = async function(userId, email) {
    currentCollectionUserId = userId;
    currentCollectionPage = 0;

    // Show modal
    const modal = document.getElementById('viewCollectionModal');
    if (!modal) return;

    document.getElementById('collectionModalUserEmail').textContent = email;
    modal.classList.remove('hidden');

    // Load collection
    await loadCollectionModalData();

    // Setup search
    const searchInput = document.getElementById('collectionModalSearch');
    if (searchInput) {
        searchInput.value = '';
        searchInput.oninput = debounce(() => {
            currentCollectionPage = 0;
            renderCollectionModalList();
        }, 300);
    }
};

/**
 * Load collection data for modal
 */
async function loadCollectionModalData() {
    const listContainer = document.getElementById('collectionModalList');
    const statsContainer = document.getElementById('collectionModalStats');

    try {
        listContainer.innerHTML = '<div class="loading">Cargando colección...</div>';

        const data = await getUserCollection(currentCollectionUserId, 1000, 0);
        currentCollectionData = data;

        // Render stats
        statsContainer.innerHTML = `
            <div class="collection-modal-stat">
                <div class="collection-modal-stat-value">${data.total || data.cards?.length || 0}</div>
                <div class="collection-modal-stat-label">Total Cartas</div>
            </div>
        `;

        // Render list
        renderCollectionModalList();
    } catch (error) {
        listContainer.innerHTML = `<div class="error-message">Error: ${error.message}</div>`;
    }
}

/**
 * Render collection list with pagination and search
 */
function renderCollectionModalList() {
    const listContainer = document.getElementById('collectionModalList');
    const paginationContainer = document.getElementById('collectionModalPagination');
    const searchTerm = document.getElementById('collectionModalSearch')?.value.toLowerCase() || '';

    if (!currentCollectionData || !currentCollectionData.cards) {
        listContainer.innerHTML = '<div class="empty-state">No hay cartas en esta colección</div>';
        paginationContainer.innerHTML = '';
        return;
    }

    // Filter cards
    let cards = currentCollectionData.cards;
    if (searchTerm) {
        cards = cards.filter(card =>
            card.name.toLowerCase().includes(searchTerm) ||
            (card.type_line && card.type_line.toLowerCase().includes(searchTerm))
        );
    }

    // Paginate
    const totalPages = Math.ceil(cards.length / ITEMS_PER_PAGE);
    const startIdx = currentCollectionPage * ITEMS_PER_PAGE;
    const endIdx = startIdx + ITEMS_PER_PAGE;
    const pageCards = cards.slice(startIdx, endIdx);

    // Render cards
    if (pageCards.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">No se encontraron cartas</div>';
    } else {
        listContainer.innerHTML = pageCards.map(card => `
            <div class="collection-modal-item">
                <div>
                    <div class="collection-modal-item-name">${card.name}</div>
                    <div class="collection-modal-item-type">${card.type_line || 'Sin tipo'}</div>
                </div>
            </div>
        `).join('');
    }

    // Render pagination
    if (totalPages > 1) {
        paginationContainer.innerHTML = `
            <button onclick="collectionModalPrevPage()" ${currentCollectionPage === 0 ? 'disabled' : ''}>
                Anterior
            </button>
            <span>Página ${currentCollectionPage + 1} de ${totalPages} (${cards.length} cartas)</span>
            <button onclick="collectionModalNextPage()" ${currentCollectionPage >= totalPages - 1 ? 'disabled' : ''}>
                Siguiente
            </button>
        `;
    } else {
        paginationContainer.innerHTML = cards.length > 0 ? `<span>${cards.length} cartas</span>` : '';
    }
}

window.collectionModalPrevPage = function() {
    if (currentCollectionPage > 0) {
        currentCollectionPage--;
        renderCollectionModalList();
    }
};

window.collectionModalNextPage = function() {
    currentCollectionPage++;
    renderCollectionModalList();
};

/**
 * Export current user's collection to CSV
 */
window.exportUserCollection = function() {
    if (!currentCollectionData || !currentCollectionData.cards) {
        alert('No hay datos para exportar');
        return;
    }

    const headers = ['Nombre', 'Tipo', 'Mana Cost'];
    const rows = currentCollectionData.cards.map(card => [
        card.name,
        card.type_line || '',
        card.mana_cost || ''
    ]);

    const csv = [headers, ...rows].map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const email = document.getElementById('collectionModalUserEmail')?.textContent || 'usuario';
    downloadCSV(csv, `coleccion_${email.replace('@', '_')}.csv`);
};

/**
 * Close collection modal
 */
window.closeCollectionModal = function() {
    const modal = document.getElementById('viewCollectionModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentCollectionUserId = null;
    currentCollectionData = null;
};

/**
 * Edit a user's card limit via modal
 */
window.editUserLimit = function(userId, email, currentLimit, currentReason) {
    currentEditLimitUserId = userId;

    // Populate modal
    document.getElementById('editLimitUserEmail').textContent = email;
    document.getElementById('editLimitCurrentValue').textContent = currentLimit;
    document.getElementById('editLimitNewValue').value = currentLimit;

    // Set reason
    const reasonPreset = document.getElementById('editLimitReasonPreset');
    const reasonCustom = document.getElementById('editLimitReasonCustom');

    if (currentReason) {
        const presetOptions = ['Usuario Premium', 'Beta Tester', 'Coleccionista Activo', 'Solicitud del usuario'];
        if (presetOptions.includes(currentReason)) {
            reasonPreset.value = currentReason;
            reasonCustom.style.display = 'none';
        } else {
            reasonPreset.value = 'custom';
            reasonCustom.value = currentReason;
            reasonCustom.style.display = 'block';
        }
    } else {
        reasonPreset.value = '';
        reasonCustom.value = '';
        reasonCustom.style.display = 'none';
    }

    // Show modal
    document.getElementById('editLimitModal').classList.remove('hidden');
};

/**
 * Set limit from preset button
 */
window.setLimitPreset = function(value) {
    document.getElementById('editLimitNewValue').value = value;
};

/**
 * Update reason field based on preset selection
 */
window.updateReasonFromPreset = function() {
    const preset = document.getElementById('editLimitReasonPreset').value;
    const customInput = document.getElementById('editLimitReasonCustom');

    if (preset === 'custom') {
        customInput.style.display = 'block';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
    }
};

/**
 * Save user limit from modal
 */
window.saveUserLimit = async function() {
    const newLimit = parseInt(document.getElementById('editLimitNewValue').value);
    const reasonPreset = document.getElementById('editLimitReasonPreset').value;
    const reasonCustom = document.getElementById('editLimitReasonCustom').value;

    if (isNaN(newLimit) || newLimit < 1 || newLimit > 50000) {
        alert('El límite debe ser un número entre 1 y 50,000');
        return;
    }

    let reason = null;
    if (reasonPreset === 'custom') {
        reason = reasonCustom || null;
    } else if (reasonPreset) {
        reason = reasonPreset;
    }

    try {
        await updateUserLimit(currentEditLimitUserId, newLimit, reason);

        // Close modal
        closeEditLimitModal();

        // Refresh users table
        loadUsersSubtab();

        // Show success message
        showNotification('Límite actualizado correctamente', 'success');
    } catch (error) {
        alert('Error al actualizar límite: ' + error.message);
    }
};

/**
 * Close edit limit modal
 */
window.closeEditLimitModal = function() {
    document.getElementById('editLimitModal').classList.add('hidden');
    currentEditLimitUserId = null;
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
        showNotification(`${email} ahora es administrador`, 'success');
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
        showNotification(`Privilegios de admin revocados para ${email}`, 'success');
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
    // Setup user menu toggle first (needed by admin panel button)
    const userMenuToggle = document.getElementById('userMenuToggle');
    const userDropdown = document.getElementById('userDropdown');

    if (userMenuToggle && userDropdown) {
        if (!userMenuToggle.dataset.toggleBound) {
            userMenuToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = userDropdown.classList.toggle('hidden');
                // Toggle arrow rotation
                userMenuToggle.classList.toggle('open', !isHidden);
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
        }
    }

    // Check admin status and setup admin features
    const adminCheck = await checkAdminStatus();

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

        // Close modals on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeCollectionModal();
                closeEditLimitModal();
            }
        });

        // Close modals on overlay click
        document.getElementById('viewCollectionModal')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('admin-modal-overlay')) {
                closeCollectionModal();
            }
        });

        document.getElementById('editLimitModal')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('admin-modal-overlay')) {
                closeEditLimitModal();
            }
        });
    }
}

/**
 * Utility: Download CSV file
 */
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

/**
 * Utility: Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Utility: Show notification
 */
function showNotification(message, type = 'info') {
    // Check if notifications system exists
    if (window.showNotification) {
        window.showNotification(message, type);
    } else {
        // Fallback to simple alert for success messages
        if (type === 'success') {
            // Don't show alert for success, it's disruptive
            console.log(`[Admin] ${message}`);
        }
    }
}
