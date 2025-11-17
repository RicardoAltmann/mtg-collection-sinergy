import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SCRYFALL_API = 'https://api.scryfall.com';
const COLLECTION_FILE = path.join(__dirname, 'collection.json');

// Initialize Supabase (only if credentials are provided)
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
    : null;

const USE_SUPABASE = !!supabase;

// Middleware
app.use(cors());
app.use(express.json());

// Middleware to create authenticated Supabase client per request
function getSupabaseClient(req) {
    if (!USE_SUPABASE) return null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        });
    }
    return supabase; // Return default client for unauthenticated requests
}

// Authentication middleware - validates user session before accessing protected routes
async function requireAuth(req, res, next) {
    // Skip authentication if not using Supabase
    if (!USE_SUPABASE) {
        req.supabaseClient = null;
        return next();
    }

    const client = getSupabaseClient(req);

    try {
        // Verify the user is authenticated
        const { data: { user }, error } = await client.auth.getUser();

        if (error) {
            return res.status(401).json({
                error: 'Authentication failed',
                message: error.message
            });
        }

        if (!user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required. Please log in.'
            });
        }

        // Attach authenticated client and user to request
        req.supabaseClient = client;
        req.user = user;
        next();
    } catch (error) {
        console.error('Authentication middleware error:', error);
        res.status(401).json({
            error: 'Authentication failed',
            message: 'Unable to verify authentication. Please log in again.'
        });
    }
}

// Rate limiting for Scryfall API
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // 100ms between requests

// Resilient fetch with timeout and retry logic
const FETCH_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

async function resilientFetch(url, options = {}, retryCount = 0) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);

        // Check if it's a timeout or network error and we have retries left
        const isRetriableError = error.name === 'AbortError' ||
                                 error.message.includes('fetch') ||
                                 error.message.includes('network');

        if (isRetriableError && retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAYS[retryCount];
            console.warn(`Fetch failed for ${url}, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return resilientFetch(url, options, retryCount + 1);
        }

        // Re-throw if not retriable or out of retries
        throw error;
    }
}

async function rateLimitedFetch(url) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve =>
            setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
        );
    }

    lastRequestTime = Date.now();
    return resilientFetch(url);
}

// EDHRec cache (in-memory, 24 hour TTL)
const edhrecCache = new Map();
const EDHREC_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function parseEDHRecData(raw) {
    const topCards = [];
    const highSynergy = [];

    try {
        const cardlists = raw?.container?.json_dict?.cardlists || [];

        cardlists.forEach(list => {
            const header = list.header || '';
            const cardviews = list.cardviews || [];

            if (header.includes('Top Cards')) {
                cardviews.forEach(c => {
                    topCards.push({
                        name: c.name.toLowerCase(),
                        inclusion: c.num_decks || 0,
                        synergy: c.synergy || 0
                    });
                });
            }

            if (header.includes('High Synergy')) {
                cardviews.forEach(c => {
                    highSynergy.push({
                        name: c.name.toLowerCase(),
                        synergy: c.synergy || 0
                    });
                });
            }
        });
    } catch (e) {
        console.warn('EDHRec parsing error:', e);
    }

    return { topCards, highSynergy };
}

async function fetchEDHRecDataFromAPI(commanderSlug) {
    try {
        const url = `https://json.edhrec.com/commanders/${commanderSlug}.json`;
        console.log(`Fetching EDHRec data for: ${commanderSlug}`);

        const response = await resilientFetch(url);

        if (!response.ok) {
            throw new Error(`EDHRec returned ${response.status}`);
        }

        const data = await response.json();
        const parsed = parseEDHRecData(data);

        // Cache it
        edhrecCache.set(commanderSlug, {
            data: parsed,
            timestamp: Date.now()
        });

        console.log(`✓ EDHRec data cached for ${commanderSlug}: ${parsed.topCards.length} top cards, ${parsed.highSynergy.length} high synergy`);

        return parsed;
    } catch (error) {
        console.error('EDHRec fetch failed:', error);
        throw error;
    }
}

// Collection storage functions - work with both Supabase and local file
// =====================================================
// COLLECTION FUNCTIONS (Normalized Schema)
// =====================================================

/**
 * Load collection with pagination support
 */
async function loadCollectionPaginated(supabaseClient, userId, {
    limit = 50,
    offset = 0,
    sortBy = 'date',
    sortOrder = 'desc'
} = {}) {
    if (!USE_SUPABASE || !supabaseClient || !userId) {
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
        const { count, error: countError } = await supabaseClient
            .from('user_collections')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (countError) throw countError;

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

        if (sortBy === 'date') {
            query = query.order('added_at', { ascending: sortOrder === 'asc' });
        } else {
            query = query.order('added_at', { ascending: false });
        }

        const { data, error } = await query;
        if (error) throw error;

        let cards = data.map(row => ({
            ...row.master_cards.card_data,
            collection_id: row.id,
            added_at: row.added_at
        }));

        if (sortBy === 'name') {
            cards.sort((a, b) => {
                const comparison = a.name.localeCompare(b.name);
                return sortOrder === 'asc' ? comparison : -comparison;
            });
        } else if (sortBy === 'type') {
            cards.sort((a, b) => {
                const comparison = a.type_line.localeCompare(b.type_line);
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

// Legacy function for backward compatibility
async function loadCollection(supabaseClient, userId) {
    const result = await loadCollectionPaginated(supabaseClient, userId, {
        limit: 10000,
        offset: 0
    });
    return result.cards;
}

async function saveCollection(supabaseClient, userId, collection) {
    if (USE_SUPABASE && supabaseClient && userId) {
        // Clear existing and insert new
        await supabaseClient.from('cards').delete().eq('user_id', userId);

        if (collection.length > 0) {
            const rows = collection.map(card => ({
                user_id: userId,
                card_data: card
            }));

            const { error } = await supabaseClient.from('cards').insert(rows);
            if (error) throw error;
        }
    } else {
        await fs.writeFile(COLLECTION_FILE, JSON.stringify(collection, null, 2));
    }
}

// Helper function to optimize card data (reduce size from ~8KB to ~2-3KB)
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

async function addCardToCollection(supabaseClient, userId, cardData) {
    if (USE_SUPABASE && supabaseClient && userId) {
        try {
            const cardId = cardData.id;
            const optimizedData = optimizeCardData(cardData);

            // Insert into master_cards (upsert)
            const { error: masterError } = await supabaseClient
                .from('master_cards')
                .upsert({
                    id: cardId,
                    name: cardData.name,
                    card_data: optimizedData,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'id',
                    ignoreDuplicates: false
                });

            if (masterError) {
                console.error('Error upserting to master_cards:', masterError);
                throw masterError;
            }

            // Add to user collection
            const { error: collectionError } = await supabaseClient
                .from('user_collections')
                .insert({
                    user_id: userId,
                    card_id: cardId
                });

            if (collectionError) {
                if (collectionError.code === '23505') {
                    return false; // Already exists
                }
                throw collectionError;
            }

            return true;
        } catch (error) {
            console.error('Error adding card to collection:', error);
            throw error;
        }
    } else {
        const collection = await loadCollection(null, null);
        collection.push(cardData);
        await saveCollection(null, null, collection);
        return true;
    }
}

async function removeCardFromCollection(supabaseClient, userId, cardName) {
    if (USE_SUPABASE && supabaseClient && userId) {
        try {
            // Find the card_id by name (case-insensitive)
            const { data: masterCard, error: findError } = await supabaseClient
                .from('master_cards')
                .select('id')
                .ilike('name', cardName)
                .single();

            if (findError || !masterCard) {
                console.log(`Card "${cardName}" not found in master_cards`);
                return false;
            }

            // Delete from user_collections
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
    } else {
        const collection = await loadCollection(null, null);
        const filtered = collection.filter(card =>
            card.name.toLowerCase() !== cardName.toLowerCase()
        );

        if (filtered.length === collection.length) {
            return false;
        }

        await saveCollection(null, null, filtered);
        return true;
    }
}

// ====================
// USER LIMIT FUNCTIONS
// ====================

async function getUserCardLimit(supabaseClient, userId) {
    if (!USE_SUPABASE || !supabaseClient || !userId) {
        return 500;
    }

    try {
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

// ====================
// ADMIN FUNCTIONS
// ====================

// Check if current user is admin
async function isUserAdmin(supabaseClient) {
    if (!USE_SUPABASE || !supabaseClient) {
        console.log('[isUserAdmin] Supabase not configured or no client provided');
        return false;
    }

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        console.log('[isUserAdmin] Retrieved user:', user ? { id: user.id, email: user.email } : null);

        if (!user) {
            console.log('[isUserAdmin] No authenticated user found');
            return false;
        }

        const { data, error } = await supabaseClient
            .from('admins')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) {
            console.error('[isUserAdmin] Error checking admin status:', error);
            return false;
        }

        const isAdmin = !!data;
        console.log('[isUserAdmin] Admin check result:', { userId: user.id, isAdmin, data });
        return isAdmin;
    } catch (error) {
        console.error('[isUserAdmin] Exception in isUserAdmin:', error);
        return false;
    }
}

// Middleware to require admin privileges
async function requireAdmin(req, res, next) {
    if (!USE_SUPABASE) {
        return res.status(403).json({ error: 'Admin features require Supabase authentication' });
    }

    const client = getSupabaseClient(req);
    if (!client) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const isAdmin = await isUserAdmin(client);
    if (!isAdmin) {
        return res.status(403).json({ error: 'Admin privileges required' });
    }

    req.supabaseClient = client;
    next();
}

// Get all users with their card counts (admin only)
async function getAllUsersStats(supabaseClient) {
    const { data: users, error: usersError } = await supabaseClient.auth.admin.listUsers();
    if (usersError) throw usersError;

    const { data: collections, error: collectionsError } = await supabaseClient
        .from('user_collections')
        .select('user_id');
    if (collectionsError) throw collectionsError;

    // Count cards per user
    const countMap = {};
    collections.forEach(row => {
        countMap[row.user_id] = (countMap[row.user_id] || 0) + 1;
    });

    // Get custom limits
    const { data: limits, error: limitsError } = await supabaseClient
        .from('user_limits')
        .select('user_id, max_cards, custom_limit_reason');
    if (limitsError) throw limitsError;

    const limitsMap = {};
    limits.forEach(limit => {
        limitsMap[limit.user_id] = limit;
    });

    // Get admin list
    const { data: admins } = await supabaseClient.from('admins').select('user_id');
    const adminIds = new Set(admins?.map(a => a.user_id) || []);

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

async function updateUserLimit(supabaseClient, targetUserId, newLimit, reason = null) {
    if (!USE_SUPABASE || !supabaseClient) {
        throw new Error('User limits require Supabase');
    }

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

// API Routes

// Get configuration (Supabase credentials)
app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL || null,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
        useAuth: USE_SUPABASE
    });
});

// Get a single card from Scryfall
app.get('/api/card/:name', async (req, res) => {
    try {
        const cardName = req.params.name;
        const response = await rateLimitedFetch(
            `${SCRYFALL_API}/cards/named?exact=${encodeURIComponent(cardName)}`
        );

        if (!response.ok) {
            return res.status(404).json({ error: `Card not found: ${cardName}` });
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Batch fetch multiple cards
app.post('/api/cards/batch', async (req, res) => {
    try {
        const { cardNames } = req.body;

        if (!Array.isArray(cardNames)) {
            return res.status(400).json({ error: 'cardNames must be an array' });
        }

        const results = [];
        const errors = [];

        for (const cardName of cardNames) {
            try {
                const response = await rateLimitedFetch(
                    `${SCRYFALL_API}/cards/named?fuzzy=${encodeURIComponent(cardName)}`
                );

                if (response.ok) {
                    const data = await response.json();
                    results.push(data);
                } else {
                    errors.push(cardName);
                }
            } catch (error) {
                errors.push(cardName);
            }
        }

        res.json({ results, errors });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// EDHRec endpoint - Get synergy data for a commander
app.get('/api/edhrec/:commanderSlug', async (req, res) => {
    try {
        const { commanderSlug } = req.params;

        // Check cache first
        const cached = edhrecCache.get(commanderSlug);
        if (cached && (Date.now() - cached.timestamp < EDHREC_CACHE_TTL)) {
            console.log(`EDHRec cache hit: ${commanderSlug}`);
            return res.json({
                ...cached.data,
                cached: true
            });
        }

        // Fetch from EDHRec
        const data = await fetchEDHRecDataFromAPI(commanderSlug);

        res.json({
            ...data,
            cached: false
        });
    } catch (error) {
        console.error('EDHRec endpoint error:', error);
        res.status(500).json({
            error: 'EDHRec data unavailable',
            message: error.message,
            topCards: [],
            highSynergy: []
        });
    }
});

// Get collection with pagination
app.get('/api/collection', requireAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const sortBy = req.query.sortBy || 'date';
        const sortOrder = req.query.sortOrder || 'desc';

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

        const result = await loadCollectionPaginated(req.supabaseClient, req.user?.id, {
            limit,
            offset,
            sortBy,
            sortOrder
        });

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

// Add cards to collection
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

        // Check if user can add these cards (limit check)
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

        const collection = await loadCollection(req.supabaseClient, req.user?.id);
        const results = [];
        const errors = [];
        const skipped = [];

        for (const cardName of uniqueNames) {
            // Check if card already exists in collection
            const exists = collection.some(card =>
                card.name.toLowerCase() === cardName.toLowerCase()
            );

            if (exists) {
                skipped.push(cardName);
                continue;
            }

            try {
                const response = await rateLimitedFetch(
                    `${SCRYFALL_API}/cards/named?fuzzy=${encodeURIComponent(cardName)}`
                );

                if (response.ok) {
                    const data = await response.json();
                    await addCardToCollection(req.supabaseClient, req.user?.id, data);
                    results.push(data.name);
                    // CRITICAL: Update in-memory collection to prevent duplicates in same request
                    collection.push(data);
                } else {
                    errors.push(cardName);
                }
            } catch (error) {
                console.error(`Error fetching card ${cardName}:`, error);
                errors.push(cardName);
            }
        }

        const [finalCount, userLimit] = await Promise.all([
            getUserCardCount(req.supabaseClient, req.user?.id),
            getUserCardLimit(req.supabaseClient, req.user?.id)
        ]);

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
        if (USE_SUPABASE && req.supabaseClient && req.user?.id) {
            const { error } = await req.supabaseClient
                .from('user_collections')
                .delete()
                .eq('user_id', req.user.id);
            if (error) throw error;
        } else {
            await saveCollection(req.supabaseClient, req.user?.id, []);
        }

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

// ====================
// ADMIN ROUTES
// ====================

// Check if current user is admin
app.get('/api/admin/check', requireAuth, async (req, res) => {
    try {
        console.log('[/api/admin/check] Request received');
        console.log('[/api/admin/check] Headers present:', {
            hasAuthorization: !!req.headers.authorization,
            authHeader: req.headers.authorization ? 'Bearer ***' : 'none'
        });

        const client = getSupabaseClient(req);
        if (!client) {
            console.log('[/api/admin/check] No Supabase client - returning isAdmin: false');
            return res.json({ isAdmin: false });
        }

        console.log('[/api/admin/check] Supabase client created, checking admin status...');
        const isAdmin = await isUserAdmin(client);
        const { data: { user } } = await client.auth.getUser();

        const response = {
            isAdmin,
            userId: user?.id,
            email: user?.email
        };
        console.log('[/api/admin/check] Sending response:', response);

        res.json(response);
    } catch (error) {
        console.error('[/api/admin/check] Error:', error);
        res.status(500).json({ error: error.message, isAdmin: false });
    }
});

// Get all users and statistics (admin only)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const stats = await getAllUsersStats(req.supabaseClient);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get system statistics (admin only)
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        const client = req.supabaseClient;

        // Get total users
        const { data: users } = await client.auth.admin.listUsers();
        const totalUsers = users?.users?.length || 0;

        // Get total cards in all collections
        const { count: totalCollections } = await client
            .from('user_collections')
            .select('*', { count: 'exact', head: true });

        // Get total unique cards in master_cards
        const { count: totalMasterCards } = await client
            .from('master_cards')
            .select('*', { count: 'exact', head: true });

        // Get total admins
        const { data: admins } = await client.from('admins').select('user_id');
        const totalAdmins = admins?.length || 0;

        // Calculate storage savings
        const avgCardSize = 3000; // bytes (optimized)
        const oldSchemaSize = totalCollections * 8000;
        const newSchemaSize = (totalMasterCards * avgCardSize) + (totalCollections * 40);
        const spaceSavings = oldSchemaSize > 0 ? ((oldSchemaSize - newSchemaSize) / oldSchemaSize * 100).toFixed(1) : 0;

        res.json({
            totalUsers,
            totalCards: totalCollections,
            uniqueCards: totalMasterCards,
            totalAdmins,
            averageCardsPerUser: totalUsers > 0 ? (totalCollections / totalUsers).toFixed(2) : 0,
            storage: {
                old_schema_mb: (oldSchemaSize / 1024 / 1024).toFixed(2),
                new_schema_mb: (newSchemaSize / 1024 / 1024).toFixed(2),
                savings_percentage: spaceSavings,
                savings_mb: ((oldSchemaSize - newSchemaSize) / 1024 / 1024).toFixed(2)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Grant admin privileges (admin only)
app.post('/api/admin/grant', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const client = req.supabaseClient;
        const { data: { user } } = await client.auth.getUser();

        const { error } = await client
            .from('admins')
            .insert([{
                user_id: userId,
                granted_by: user.id
            }]);

        if (error) {
            if (error.code === '23505') { // Unique violation
                return res.status(400).json({ error: 'User is already an admin' });
            }
            throw error;
        }

        res.json({ message: 'Admin privileges granted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Revoke admin privileges (admin only)
app.delete('/api/admin/revoke/:userId', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const client = req.supabaseClient;
        const { data: { user } } = await client.auth.getUser();

        // Prevent self-revocation
        if (userId === user.id) {
            return res.status(400).json({ error: 'Cannot revoke your own admin privileges' });
        }

        const { error } = await client
            .from('admins')
            .delete()
            .eq('user_id', userId);

        if (error) throw error;

        res.json({ message: 'Admin privileges revoked successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user's collection by user ID (admin only)
app.get('/api/admin/user/:userId/collection', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const client = req.supabaseClient;

        const result = await loadCollectionPaginated(client, userId, {
            limit: parseInt(req.query.limit) || 100,
            offset: parseInt(req.query.offset) || 0
        });

        res.json({
            userId,
            ...result
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ====================
// USER LIMIT ROUTES (Admin)
// ====================

// Get user's limit info (for viewing in admin panel)
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

// Update user's card limit (admin only)
app.put('/api/admin/users/:userId/limit', requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { max_cards, reason } = req.body;

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

// Serve static files from src/ directory (CSS, JS modules)
app.use('/src', express.static(path.join(__dirname, 'src'), {
    setHeaders: (res, filepath) => {
        // Set correct MIME type for JavaScript modules
        if (filepath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Serve public directory (images, fonts, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export for Vercel serverless
export default app;

// Start server only if not in Vercel
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🎴 MTG Synergy Analyzer running on http://localhost:${PORT}`);
        console.log(`📊 Storage: ${USE_SUPABASE ? 'Supabase' : 'Local file'}`);
        if (!USE_SUPABASE) {
            console.log(`📁 Collection file: ${COLLECTION_FILE}`);
        }
    });
}
