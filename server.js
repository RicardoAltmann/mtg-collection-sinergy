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
async function loadCollection(supabaseClient, userId) {
    if (USE_SUPABASE && supabaseClient && userId) {
        const { data, error } = await supabaseClient
            .from('cards')
            .select('card_data')
            .eq('user_id', userId)  // CRITICAL: Filter by user_id for data isolation
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data ? data.map(row => row.card_data) : [];
    } else {
        try {
            const data = await fs.readFile(COLLECTION_FILE, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }
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

async function addCardToCollection(supabaseClient, userId, cardData) {
    if (USE_SUPABASE && supabaseClient && userId) {
        const { error } = await supabaseClient
            .from('cards')
            .insert([{
                user_id: userId,
                card_data: cardData
            }]);

        if (error) throw error;
    } else {
        const collection = await loadCollection(null, null);
        collection.push(cardData);
        await saveCollection(null, null, collection);
    }
}

async function removeCardFromCollection(supabaseClient, userId, cardName) {
    if (USE_SUPABASE && supabaseClient && userId) {
        // Find and delete the card
        const collection = await loadCollection(supabaseClient, userId);
        const filtered = collection.filter(card =>
            card.name.toLowerCase() !== cardName.toLowerCase()
        );

        if (filtered.length === collection.length) {
            return false; // Card not found
        }

        await saveCollection(supabaseClient, userId, filtered);
        return true;
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
// ADMIN FUNCTIONS
// ====================

// Check if current user is admin
async function isUserAdmin(supabaseClient) {
    if (!USE_SUPABASE || !supabaseClient) return false;

    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return false;

        const { data, error } = await supabaseClient
            .from('admins')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) {
            console.error('Error checking admin status:', error);
            return false;
        }

        return !!data;
    } catch (error) {
        console.error('Error in isUserAdmin:', error);
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

    const { data: cardCounts, error: cardsError } = await supabaseClient
        .from('cards')
        .select('user_id');
    if (cardsError) throw cardsError;

    // Count cards per user
    const countMap = {};
    cardCounts.forEach(card => {
        countMap[card.user_id] = (countMap[card.user_id] || 0) + 1;
    });

    // Get admin list
    const { data: admins } = await supabaseClient.from('admins').select('user_id');
    const adminIds = new Set(admins?.map(a => a.user_id) || []);

    return users.users.map(user => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        card_count: countMap[user.id] || 0,
        is_admin: adminIds.has(user.id)
    }));
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

// Get entire collection
app.get('/api/collection', requireAuth, async (req, res) => {
    try {
        const collection = await loadCollection(req.supabaseClient, req.user?.id);
        res.json(collection);
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

        const updatedCollection = await loadCollection(req.supabaseClient, req.user?.id);

        res.json({
            added: results,
            errors,
            skipped,
            totalInCollection: updatedCollection.length
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

        const collection = await loadCollection(req.supabaseClient, req.user?.id);

        res.json({
            message: 'Card removed successfully',
            totalInCollection: collection.length
        });
    } catch (error) {
        console.error('Error removing card from collection:', error);
        res.status(500).json({ error: 'Failed to remove card from collection' });
    }
});

// Clear entire collection
app.delete('/api/collection', requireAuth, async (req, res) => {
    try {
        await saveCollection(req.supabaseClient, req.user?.id, []);
        res.json({ message: 'Collection cleared successfully' });
    } catch (error) {
        console.error('Error clearing collection:', error);
        res.status(500).json({ error: 'Failed to clear collection' });
    }
});

// ====================
// ADMIN ROUTES
// ====================

// Check if current user is admin
app.get('/api/admin/check', async (req, res) => {
    try {
        const client = getSupabaseClient(req);
        if (!client) {
            return res.json({ isAdmin: false });
        }

        const isAdmin = await isUserAdmin(client);
        const { data: { user } } = await client.auth.getUser();

        res.json({
            isAdmin,
            userId: user?.id,
            email: user?.email
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
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

        // Get total cards across all users
        const { count: totalCards } = await client
            .from('cards')
            .select('*', { count: 'exact', head: true });

        // Get total admins
        const { data: admins } = await client.from('admins').select('user_id');
        const totalAdmins = admins?.length || 0;

        // Get unique card names
        const { data: cardData } = await client
            .from('cards')
            .select('card_data');

        const uniqueCardNames = new Set(
            cardData?.map(c => c.card_data?.name?.toLowerCase()) || []
        );

        res.json({
            totalUsers,
            totalCards,
            totalAdmins,
            uniqueCards: uniqueCardNames.size,
            averageCardsPerUser: totalUsers > 0 ? (totalCards / totalUsers).toFixed(2) : 0
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

        const { data, error } = await client
            .from('cards')
            .select('card_data, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        res.json({
            userId,
            cards: data ? data.map(row => row.card_data) : [],
            totalCards: data?.length || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
