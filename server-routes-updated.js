// =====================================================
// RUTAS ACTUALIZADAS CON PAGINACIÓN Y LÍMITES
// =====================================================
// Este archivo contiene las rutas actualizadas de server.js
// para trabajar con el esquema normalizado

// ====================
// COLLECTION ROUTES (Updated)
// ====================

// Get collection with pagination
app.get('/api/collection', requireAuth, async (req, res) => {
    try {
        // Parse query parameters
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const sortBy = req.query.sortBy || 'date'; // 'name' | 'type' | 'date'
        const sortOrder = req.query.sortOrder || 'desc'; // 'asc' | 'desc'

        // Validate parameters
        if (limit < 1 || limit > 200) {
            return res.status(400).json({ error: 'Limit must be between 1 and 200' });
        }

        if (offset < 0) {
            return res.status(400).json({ error: 'Offset must be non-negative' });
        }

        if (!['name', 'type', 'date'].includes(sortBy)) {
            return res.status(400).json({ error: 'sortBy must be one of: name, type, date' });
        }

        if (!['asc', 'desc'].includes(sortOrder)) {
            return res.status(400).json({ error: 'sortOrder must be either asc or desc' });
        }

        // Load paginated collection
        const result = await loadCollectionPaginated(req.supabaseClient, req.user?.id, {
            limit,
            offset,
            sortBy,
            sortOrder
        });

        // Get user's limit info
        const [userLimit, cardCount] = await Promise.all([
            getUserCardLimit(req.supabaseClient, req.user?.id),
            getUserCardCount(req.supabaseClient, req.user?.id)
        ]);

        res.json({
            ...result,
            userLimit: {
                max_cards: userLimit,
                current_count: cardCount,
                remaining: userLimit - cardCount,
                usage_percentage: Math.round((cardCount / userLimit) * 100)
            }
        });
    } catch (error) {
        console.error('Error loading collection:', error);
        res.status(500).json({ error: 'Failed to load collection' });
    }
});

// Add cards to collection (with limit check)
app.post('/api/collection', requireAuth, async (req, res) => {
    try {
        const { cardNames } = req.body;

        // Validate input is an array
        if (!Array.isArray(cardNames)) {
            return res.status(400).json({ error: 'cardNames must be an array' });
        }

        // Validate and normalize card names
        const MAX_CARD_NAME_LENGTH = 200;
        const MAX_CARDS_PER_REQUEST = 100;
        const invalidInputs = [];
        const normalizedNames = [];

        for (const name of cardNames) {
            // Reject non-string values
            if (typeof name !== 'string') {
                invalidInputs.push({ value: name, reason: 'not a string' });
                continue;
            }

            // Trim and normalize
            const trimmed = name.trim();

            // Reject empty strings
            if (trimmed.length === 0) {
                invalidInputs.push({ value: name, reason: 'empty after trim' });
                continue;
            }

            // Reject overly long names
            if (trimmed.length > MAX_CARD_NAME_LENGTH) {
                invalidInputs.push({ value: name, reason: `exceeds max length of ${MAX_CARD_NAME_LENGTH}` });
                continue;
            }

            normalizedNames.push(trimmed);
        }

        // Return early if there are invalid inputs
        if (invalidInputs.length > 0) {
            return res.status(400).json({
                error: 'Invalid card names provided',
                invalidInputs,
                message: 'All card names must be non-empty strings with max length of 200 characters'
            });
        }

        // Deduplicate (case-insensitive)
        const uniqueNames = [...new Set(normalizedNames.map(n => n.toLowerCase()))];

        // Limit number of cards per request
        if (uniqueNames.length > MAX_CARDS_PER_REQUEST) {
            return res.status(400).json({
                error: `Too many cards requested. Maximum is ${MAX_CARDS_PER_REQUEST} per request`,
                requested: uniqueNames.length
            });
        }

        // ✨ NEW: Check if user can add these cards (limit check)
        const limitCheck = await checkUserCanAddCards(
            req.supabaseClient,
            req.user?.id,
            uniqueNames.length
        );

        if (!limitCheck.canAdd) {
            return res.status(403).json({
                error: 'Card limit exceeded',
                message: `You can only add ${limitCheck.remaining} more card(s). You tried to add ${uniqueNames.length}.`,
                currentCount: limitCheck.currentCount,
                limit: limitCheck.limit,
                remaining: limitCheck.remaining,
                wouldExceedBy: limitCheck.wouldExceedBy
            });
        }

        // Process cards
        const results = [];
        const errors = [];
        const skipped = [];

        // Get current card count for duplicate checking
        const { cards: existingCards } = await loadCollectionPaginated(
            req.supabaseClient,
            req.user?.id,
            { limit: 10000, offset: 0 } // Load all for duplicate check
        );

        const existingNames = new Set(existingCards.map(c => c.name.toLowerCase()));

        for (const cardName of uniqueNames) {
            // Check if card already exists
            if (existingNames.has(cardName.toLowerCase())) {
                skipped.push(cardName);
                continue;
            }

            try {
                const response = await rateLimitedFetch(
                    `${SCRYFALL_API}/cards/named?fuzzy=${encodeURIComponent(cardName)}`
                );

                if (response.ok) {
                    const data = await response.json();

                    // Try to add card
                    const added = await addCardToCollection(req.supabaseClient, req.user?.id, data);

                    if (added) {
                        results.push(data.name);
                        existingNames.add(data.name.toLowerCase()); // Update in-memory set
                    } else {
                        skipped.push(cardName);
                    }
                } else {
                    errors.push(cardName);
                }
            } catch (error) {
                console.error(`Error fetching card ${cardName}:`, error);
                errors.push(cardName);
            }
        }

        // Get updated count
        const finalCount = await getUserCardCount(req.supabaseClient, req.user?.id);
        const userLimit = await getUserCardLimit(req.supabaseClient, req.user?.id);

        res.json({
            added: results,
            errors,
            skipped,
            totalInCollection: finalCount,
            limit: userLimit,
            remaining: userLimit - finalCount
        });
    } catch (error) {
        console.error('Error adding cards to collection:', error);
        res.status(500).json({ error: 'Failed to add cards to collection' });
    }
});

// Remove a card from collection
app.delete('/api/collection/:name', requireAuth, async (req, res) => {
    try {
        const cardName = req.params.name;
        const removed = await removeCardFromCollection(req.supabaseClient, req.user?.id, cardName);

        if (!removed) {
            return res.status(404).json({ error: 'Card not found in collection' });
        }

        const [cardCount, userLimit] = await Promise.all([
            getUserCardCount(req.supabaseClient, req.user?.id),
            getUserCardLimit(req.supabaseClient, req.user?.id)
        ]);

        res.json({
            message: 'Card removed successfully',
            totalInCollection: cardCount,
            limit: userLimit,
            remaining: userLimit - cardCount
        });
    } catch (error) {
        console.error('Error removing card from collection:', error);
        res.status(500).json({ error: 'Failed to remove card from collection' });
    }
});

// Clear entire collection
app.delete('/api/collection', requireAuth, async (req, res) => {
    try {
        await clearCollection(req.supabaseClient, req.user?.id);

        const userLimit = await getUserCardLimit(req.supabaseClient, req.user?.id);

        res.json({
            message: 'Collection cleared successfully',
            totalInCollection: 0,
            limit: userLimit,
            remaining: userLimit
        });
    } catch (error) {
        console.error('Error clearing collection:', error);
        res.status(500).json({ error: 'Failed to clear collection' });
    }
});

// ✨ NEW: Get user's limit info
app.get('/api/user/limit', requireAuth, async (req, res) => {
    try {
        const [limit, count] = await Promise.all([
            getUserCardLimit(req.supabaseClient, req.user?.id),
            getUserCardCount(req.supabaseClient, req.user?.id)
        ]);

        res.json({
            max_cards: limit,
            current_count: count,
            remaining: limit - count,
            usage_percentage: Math.round((count / limit) * 100)
        });
    } catch (error) {
        console.error('Error getting user limit:', error);
        res.status(500).json({ error: 'Failed to get user limit' });
    }
});

// ====================
// ADMIN ROUTES (Updated + New)
// ====================

// Get all users with stats and limits (admin only)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const stats = await getAllUsersStatsWithLimits(req.supabaseClient);
        res.json(stats);
    } catch (error) {
        console.error('Error getting users stats:', error);
        res.status(500).json({ error: 'Failed to get users stats' });
    }
});

// ✨ NEW: Update user's card limit (admin only)
app.put('/api/admin/users/:userId/limit', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { max_cards, reason } = req.body;

        // Validate input
        if (typeof max_cards !== 'number' || max_cards < 1) {
            return res.status(400).json({
                error: 'max_cards must be a positive number'
            });
        }

        if (max_cards > 50000) {
            return res.status(400).json({
                error: 'max_cards cannot exceed 50,000'
            });
        }

        // Update limit
        const updated = await updateUserLimit(
            req.supabaseClient,
            userId,
            max_cards,
            reason || null
        );

        res.json({
            message: 'User limit updated successfully',
            limit: updated
        });
    } catch (error) {
        console.error('Error updating user limit:', error);
        res.status(500).json({ error: 'Failed to update user limit' });
    }
});

// ✨ NEW: Get all custom limits (admin only)
app.get('/api/admin/limits', requireAdmin, async (req, res) => {
    try {
        const limits = await getAllUserLimits(req.supabaseClient);
        res.json(limits);
    } catch (error) {
        console.error('Error getting user limits:', error);
        res.status(500).json({ error: 'Failed to get user limits' });
    }
});

// ✨ NEW: Get system statistics (admin only)
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        // Obtener estadísticas globales
        const [totalUsers, totalCollections, totalMasterCards] = await Promise.all([
            // Total de usuarios
            req.supabaseClient.auth.admin.listUsers()
                .then(r => r.data?.users?.length || 0),

            // Total de relaciones (cartas en colecciones)
            req.supabaseClient
                .from('user_collections')
                .select('*', { count: 'exact', head: true })
                .then(r => r.count || 0),

            // Total de cartas únicas en master_cards
            req.supabaseClient
                .from('master_cards')
                .select('*', { count: 'exact', head: true })
                .then(r => r.count || 0)
        ]);

        // Calcular ahorro de espacio estimado
        const avgCardSize = 3000; // bytes (optimizado)
        const oldSchemaSize = totalCollections * 8000; // 8KB por carta duplicada
        const newSchemaSize = (totalMasterCards * avgCardSize) + (totalCollections * 40); // Master cards + relaciones
        const spaceSavings = ((oldSchemaSize - newSchemaSize) / oldSchemaSize * 100).toFixed(1);

        // Top 10 cartas más populares
        const { data: popularCards } = await req.supabaseClient
            .rpc('get_popular_cards', { top_n: 10 })
            .catch(() => ({ data: [] }));

        res.json({
            users: {
                total: totalUsers
            },
            cards: {
                unique_cards: totalMasterCards,
                total_in_collections: totalCollections,
                avg_per_user: totalUsers > 0 ? Math.round(totalCollections / totalUsers) : 0
            },
            storage: {
                old_schema_mb: (oldSchemaSize / 1024 / 1024).toFixed(2),
                new_schema_mb: (newSchemaSize / 1024 / 1024).toFixed(2),
                savings_percentage: spaceSavings,
                savings_mb: ((oldSchemaSize - newSchemaSize) / 1024 / 1024).toFixed(2)
            },
            popularCards: popularCards || []
        });
    } catch (error) {
        console.error('Error getting system stats:', error);
        res.status(500).json({ error: 'Failed to get system stats' });
    }
});

// Export routes for integration
export {
    // Collection routes
    'GET /api/collection': 'Collection with pagination and limit info',
    'POST /api/collection': 'Add cards with limit validation',
    'DELETE /api/collection/:name': 'Remove card',
    'DELETE /api/collection': 'Clear collection',
    'GET /api/user/limit': 'Get user limit info',

    // Admin routes
    'GET /api/admin/users': 'Get users with limits',
    'PUT /api/admin/users/:userId/limit': 'Update user limit',
    'GET /api/admin/limits': 'Get all custom limits',
    'GET /api/admin/stats': 'Get system statistics'
};
