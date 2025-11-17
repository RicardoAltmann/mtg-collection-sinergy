// =====================================================
// FUNCIONES ACTUALIZADAS PARA ESQUEMA NORMALIZADO
// =====================================================
// Estas funciones reemplazan las funciones antiguas del servidor
// para trabajar con master_cards + user_collections

import { optimize_card_data } from './utils/card-optimizer.js';

// =====================================================
// COLLECTION FUNCTIONS (Normalized Schema)
// =====================================================

/**
 * Carga la colección de un usuario con paginación
 * @param {Object} supabaseClient - Cliente autenticado de Supabase
 * @param {string} userId - UUID del usuario
 * @param {number} limit - Número de cartas por página (default: 50)
 * @param {number} offset - Número de cartas a saltar (default: 0)
 * @param {string} sortBy - Campo para ordenar: 'name' | 'date' | 'type' (default: 'date')
 * @param {string} sortOrder - Orden: 'asc' | 'desc' (default: 'desc')
 * @returns {Object} { cards: [], total: number, hasMore: boolean }
 */
async function loadCollectionPaginated(supabaseClient, userId, {
    limit = 50,
    offset = 0,
    sortBy = 'date',
    sortOrder = 'desc'
} = {}) {
    if (!USE_SUPABASE || !supabaseClient || !userId) {
        // Fallback para modo local (sin paginación)
        try {
            const data = await fs.readFile(COLLECTION_FILE, 'utf-8');
            const collection = JSON.parse(data);
            return {
                cards: collection.slice(offset, offset + limit),
                total: collection.length,
                hasMore: offset + limit < collection.length,
                limit,
                offset
            };
        } catch (error) {
            return { cards: [], total: 0, hasMore: false, limit, offset };
        }
    }

    try {
        // Primero obtener el total de cartas
        const { count, error: countError } = await supabaseClient
            .from('user_collections')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (countError) throw countError;

        // Determinar el campo de ordenamiento
        let orderField, orderTable;
        switch (sortBy) {
            case 'name':
                orderField = 'name';
                orderTable = 'master_cards';
                break;
            case 'type':
                orderField = 'type_line';
                orderTable = 'master_cards';
                break;
            case 'date':
            default:
                orderField = 'added_at';
                orderTable = 'user_collections';
                break;
        }

        // Cargar cartas con JOIN
        let query = supabaseClient
            .from('user_collections')
            .select(`
                id,
                card_id,
                added_at,
                master_cards (
                    id,
                    name,
                    card_data
                )
            `)
            .eq('user_id', userId)
            .range(offset, offset + limit - 1);

        // Aplicar ordenamiento
        if (orderTable === 'user_collections') {
            query = query.order(orderField, { ascending: sortOrder === 'asc' });
        } else {
            // Para ordenar por campos de master_cards, necesitamos hacerlo en el cliente
            // o usar una función de PostgreSQL
            query = query.order('added_at', { ascending: false });
        }

        const { data, error } = await query;

        if (error) throw error;

        // Transformar datos al formato esperado
        const cards = data.map(row => ({
            ...row.master_cards.card_data,
            collection_id: row.id,
            added_at: row.added_at
        }));

        // Ordenar en cliente si es necesario
        if (orderTable === 'master_cards') {
            cards.sort((a, b) => {
                const aVal = sortBy === 'name' ? a.name : a.type_line;
                const bVal = sortBy === 'name' ? b.name : b.type_line;
                const comparison = aVal.localeCompare(bVal);
                return sortOrder === 'asc' ? comparison : -comparison;
            });
        }

        return {
            cards,
            total: count || 0,
            hasMore: offset + limit < (count || 0),
            limit,
            offset
        };
    } catch (error) {
        console.error('Error loading paginated collection:', error);
        throw error;
    }
}

/**
 * Obtiene el límite de cartas para un usuario
 * @param {Object} supabaseClient - Cliente de Supabase
 * @param {string} userId - UUID del usuario
 * @returns {number} Límite de cartas (default: 500)
 */
async function getUserCardLimit(supabaseClient, userId) {
    if (!USE_SUPABASE || !supabaseClient || !userId) {
        return 500; // Default para modo local
    }

    try {
        // Usar la función de PostgreSQL
        const { data, error } = await supabaseClient
            .rpc('get_user_card_limit', { check_user_id: userId });

        if (error) {
            console.warn('Error getting user limit, using default:', error);
            return 500;
        }

        return data || 500;
    } catch (error) {
        console.warn('Error getting user limit, using default:', error);
        return 500;
    }
}

/**
 * Obtiene el número actual de cartas de un usuario
 * @param {Object} supabaseClient - Cliente de Supabase
 * @param {string} userId - UUID del usuario
 * @returns {number} Número de cartas
 */
async function getUserCardCount(supabaseClient, userId) {
    if (!USE_SUPABASE || !supabaseClient || !userId) {
        try {
            const data = await fs.readFile(COLLECTION_FILE, 'utf-8');
            const collection = JSON.parse(data);
            return collection.length;
        } catch {
            return 0;
        }
    }

    try {
        const { count, error } = await supabaseClient
            .from('user_collections')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error('Error getting card count:', error);
        return 0;
    }
}

/**
 * Verifica si un usuario puede agregar N cartas
 * @param {Object} supabaseClient - Cliente de Supabase
 * @param {string} userId - UUID del usuario
 * @param {number} numCards - Número de cartas a agregar
 * @returns {Object} { canAdd: boolean, currentCount: number, limit: number, remaining: number }
 */
async function checkUserCanAddCards(supabaseClient, userId, numCards) {
    const [currentCount, limit] = await Promise.all([
        getUserCardCount(supabaseClient, userId),
        getUserCardLimit(supabaseClient, userId)
    ]);

    const remaining = limit - currentCount;
    const canAdd = (currentCount + numCards) <= limit;

    return {
        canAdd,
        currentCount,
        limit,
        remaining,
        wouldExceedBy: canAdd ? 0 : (currentCount + numCards - limit)
    };
}

/**
 * Agrega una carta a master_cards si no existe, luego la añade a la colección del usuario
 * @param {Object} supabaseClient - Cliente de Supabase
 * @param {string} userId - UUID del usuario
 * @param {Object} cardData - Objeto completo de Scryfall
 * @returns {boolean} true si se agregó, false si ya existía
 */
async function addCardToCollection(supabaseClient, userId, cardData) {
    if (!USE_SUPABASE || !supabaseClient || !userId) {
        // Modo local (sin cambios)
        const collection = await loadCollectionPaginated(null, null);
        collection.cards.push(cardData);
        await fs.writeFile(COLLECTION_FILE, JSON.stringify(collection.cards, null, 2));
        return true;
    }

    try {
        const cardId = cardData.id;

        // 1. Optimizar card_data (reducir de ~8KB a ~2-3KB)
        const optimizedData = optimizeCardData(cardData);

        // 2. Insertar en master_cards si no existe (UPSERT)
        const { error: masterError } = await supabaseClient
            .from('master_cards')
            .upsert({
                id: cardId,
                name: cardData.name,
                card_data: optimizedData,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'id',
                ignoreDuplicates: false // Actualizar si ya existe
            });

        if (masterError) {
            console.error('Error upserting to master_cards:', masterError);
            throw masterError;
        }

        // 3. Agregar a la colección del usuario
        const { error: collectionError } = await supabaseClient
            .from('user_collections')
            .insert({
                user_id: userId,
                card_id: cardId
            });

        if (collectionError) {
            // Si es error de duplicado (unique constraint), no es un error real
            if (collectionError.code === '23505') {
                console.log(`Card ${cardData.name} already in user collection`);
                return false;
            }
            throw collectionError;
        }

        return true;
    } catch (error) {
        console.error('Error adding card to collection:', error);
        throw error;
    }
}

/**
 * Elimina una carta de la colección del usuario
 * @param {Object} supabaseClient - Cliente de Supabase
 * @param {string} userId - UUID del usuario
 * @param {string} cardName - Nombre de la carta
 * @returns {boolean} true si se eliminó, false si no existía
 */
async function removeCardFromCollection(supabaseClient, userId, cardName) {
    if (!USE_SUPABASE || !supabaseClient || !userId) {
        // Modo local (sin cambios)
        const collection = await loadCollectionPaginated(null, null);
        const filtered = collection.cards.filter(card =>
            card.name.toLowerCase() !== cardName.toLowerCase()
        );

        if (filtered.length === collection.cards.length) {
            return false;
        }

        await fs.writeFile(COLLECTION_FILE, JSON.stringify(filtered, null, 2));
        return true;
    }

    try {
        // Encontrar el card_id por nombre (case-insensitive)
        const { data: masterCard, error: findError } = await supabaseClient
            .from('master_cards')
            .select('id')
            .ilike('name', cardName)
            .single();

        if (findError || !masterCard) {
            console.log(`Card "${cardName}" not found in master_cards`);
            return false;
        }

        // Eliminar de user_collections
        const { error: deleteError } = await supabaseClient
            .from('user_collections')
            .delete()
            .eq('user_id', userId)
            .eq('card_id', masterCard.id);

        if (deleteError) throw deleteError;

        return true;
    } catch (error) {
        console.error('Error removing card from collection:', error);
        throw error;
    }
}

/**
 * Limpia toda la colección de un usuario
 * @param {Object} supabaseClient - Cliente de Supabase
 * @param {string} userId - UUID del usuario
 */
async function clearCollection(supabaseClient, userId) {
    if (!USE_SUPABASE || !supabaseClient || !userId) {
        await fs.writeFile(COLLECTION_FILE, JSON.stringify([], null, 2));
        return;
    }

    const { error } = await supabaseClient
        .from('user_collections')
        .delete()
        .eq('user_id', userId);

    if (error) throw error;
}

// =====================================================
// ADMIN FUNCTIONS - User Limits Management
// =====================================================

/**
 * Actualiza el límite de cartas de un usuario (solo admins)
 * @param {Object} supabaseClient - Cliente de Supabase (admin)
 * @param {string} targetUserId - UUID del usuario a modificar
 * @param {number} newLimit - Nuevo límite de cartas
 * @param {string} reason - Razón del cambio
 * @returns {Object} Límite actualizado
 */
async function updateUserLimit(supabaseClient, targetUserId, newLimit, reason = null) {
    if (!USE_SUPABASE || !supabaseClient) {
        throw new Error('User limits require Supabase');
    }

    // Obtener el admin que está haciendo el cambio
    const { data: { user: admin } } = await supabaseClient.auth.getUser();

    const { data, error } = await supabaseClient
        .from('user_limits')
        .upsert({
            user_id: targetUserId,
            max_cards: newLimit,
            custom_limit_reason: reason,
            updated_at: new Date().toISOString(),
            updated_by: admin?.id
        }, {
            onConflict: 'user_id'
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

/**
 * Obtiene todos los límites personalizados (admin)
 * @param {Object} supabaseClient - Cliente de Supabase (admin)
 * @returns {Array} Lista de límites personalizados
 */
async function getAllUserLimits(supabaseClient) {
    if (!USE_SUPABASE || !supabaseClient) {
        return [];
    }

    const { data, error } = await supabaseClient
        .from('user_limits')
        .select(`
            user_id,
            max_cards,
            custom_limit_reason,
            updated_at,
            updated_by
        `)
        .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

/**
 * Obtiene estadísticas de usuarios con sus límites (admin)
 * @param {Object} supabaseClient - Cliente de Supabase (admin)
 * @returns {Array} Lista de usuarios con stats
 */
async function getAllUsersStatsWithLimits(supabaseClient) {
    // Obtener usuarios
    const { data: users, error: usersError } = await supabaseClient.auth.admin.listUsers();
    if (usersError) throw usersError;

    // Obtener conteo de cartas por usuario
    const { data: collections, error: collectionsError } = await supabaseClient
        .from('user_collections')
        .select('user_id, card_id');
    if (collectionsError) throw collectionsError;

    // Contar por usuario
    const countMap = {};
    collections.forEach(row => {
        countMap[row.user_id] = (countMap[row.user_id] || 0) + 1;
    });

    // Obtener límites personalizados
    const { data: limits, error: limitsError } = await supabaseClient
        .from('user_limits')
        .select('user_id, max_cards, custom_limit_reason');
    if (limitsError) throw limitsError;

    const limitsMap = {};
    limits.forEach(limit => {
        limitsMap[limit.user_id] = limit;
    });

    // Obtener admins
    const { data: admins } = await supabaseClient.from('admins').select('user_id');
    const adminIds = new Set(admins?.map(a => a.user_id) || []);

    // Combinar todo
    return users.users.map(user => {
        const cardCount = countMap[user.id] || 0;
        const limitInfo = limitsMap[user.id];
        const maxCards = limitInfo?.max_cards || 500;

        return {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            card_count: cardCount,
            max_cards: maxCards,
            usage_percentage: Math.round((cardCount / maxCards) * 100),
            has_custom_limit: !!limitInfo,
            custom_limit_reason: limitInfo?.custom_limit_reason,
            is_admin: adminIds.has(user.id)
        };
    });
}

// =====================================================
// UTILITY: Optimizar Card Data
// =====================================================

/**
 * Reduce el JSONB de Scryfall de ~8KB a ~2-3KB
 * Solo guarda los campos que realmente usa la aplicación
 */
function optimizeCardData(fullCardData) {
    return {
        id: fullCardData.id,
        name: fullCardData.name,
        mana_cost: fullCardData.mana_cost,
        cmc: fullCardData.cmc,
        type_line: fullCardData.type_line,
        oracle_text: fullCardData.oracle_text,
        colors: fullCardData.colors,
        color_identity: fullCardData.color_identity,
        keywords: fullCardData.keywords,
        legalities: fullCardData.legalities,
        set: fullCardData.set,
        set_name: fullCardData.set_name,
        rarity: fullCardData.rarity,
        image_uris: fullCardData.image_uris,
        prices: fullCardData.prices,
        scryfall_uri: fullCardData.scryfall_uri,
        edhrec_rank: fullCardData.edhrec_rank
    };
}

export {
    loadCollectionPaginated,
    getUserCardLimit,
    getUserCardCount,
    checkUserCanAddCards,
    addCardToCollection,
    removeCardFromCollection,
    clearCollection,
    updateUserLimit,
    getAllUserLimits,
    getAllUsersStatsWithLimits,
    optimizeCardData
};
