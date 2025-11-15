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

// Rate limiting for Scryfall API
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // 100ms between requests

async function rateLimitedFetch(url) {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve =>
            setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
        );
    }

    lastRequestTime = Date.now();
    return fetch(url);
}

// Collection storage functions - work with both Supabase and local file
async function loadCollection(supabaseClient) {
    if (USE_SUPABASE && supabaseClient) {
        // Get current user to filter by user_id
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { data, error } = await supabaseClient
            .from('cards')
            .select('card_data')
            .eq('user_id', user.id)  // CRITICAL: Filter by user_id for data isolation
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

async function saveCollection(supabaseClient, collection) {
    if (USE_SUPABASE && supabaseClient) {
        // Get current user
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // Clear existing and insert new
        await supabaseClient.from('cards').delete().eq('user_id', user.id);

        if (collection.length > 0) {
            const rows = collection.map(card => ({
                user_id: user.id,
                card_data: card
            }));

            const { error } = await supabaseClient.from('cards').insert(rows);
            if (error) throw error;
        }
    } else {
        await fs.writeFile(COLLECTION_FILE, JSON.stringify(collection, null, 2));
    }
}

async function addCardToCollection(supabaseClient, cardData) {
    if (USE_SUPABASE && supabaseClient) {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const { error } = await supabaseClient
            .from('cards')
            .insert([{
                user_id: user.id,
                card_data: cardData
            }]);

        if (error) throw error;
    } else {
        const collection = await loadCollection(null);
        collection.push(cardData);
        await saveCollection(null, collection);
    }
}

async function removeCardFromCollection(supabaseClient, cardName) {
    if (USE_SUPABASE && supabaseClient) {
        // Find and delete the card
        const collection = await loadCollection(supabaseClient);
        const filtered = collection.filter(card =>
            card.name.toLowerCase() !== cardName.toLowerCase()
        );

        if (filtered.length === collection.length) {
            return false; // Card not found
        }

        await saveCollection(supabaseClient, filtered);
        return true;
    } else {
        const collection = await loadCollection(null);
        const filtered = collection.filter(card =>
            card.name.toLowerCase() !== cardName.toLowerCase()
        );

        if (filtered.length === collection.length) {
            return false;
        }

        await saveCollection(null, filtered);
        return true;
    }
}

// API Routes

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

// Get entire collection
app.get('/api/collection', async (req, res) => {
    try {
        const client = getSupabaseClient(req);
        const collection = await loadCollection(client);
        res.json(collection);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add cards to collection
app.post('/api/collection', async (req, res) => {
    try {
        const client = getSupabaseClient(req);
        const { cardNames } = req.body;

        if (!Array.isArray(cardNames)) {
            return res.status(400).json({ error: 'cardNames must be an array' });
        }

        const collection = await loadCollection(client);
        const results = [];
        const errors = [];
        const skipped = [];

        for (const cardName of cardNames) {
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
                    await addCardToCollection(client, data);
                    results.push(data.name);
                    // CRITICAL: Update in-memory collection to prevent duplicates in same request
                    collection.push(data);
                } else {
                    errors.push(cardName);
                }
            } catch (error) {
                errors.push(cardName);
            }
        }

        const updatedCollection = await loadCollection(client);

        res.json({
            added: results,
            errors,
            skipped,
            totalInCollection: updatedCollection.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove a card from collection
app.delete('/api/collection/:name', async (req, res) => {
    try {
        const client = getSupabaseClient(req);
        const cardName = req.params.name;
        const removed = await removeCardFromCollection(client, cardName);

        if (!removed) {
            return res.status(404).json({ error: 'Card not found in collection' });
        }

        const collection = await loadCollection(client);

        res.json({
            message: 'Card removed successfully',
            totalInCollection: collection.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Clear entire collection
app.delete('/api/collection', async (req, res) => {
    try {
        const client = getSupabaseClient(req);
        await saveCollection(client, []);
        res.json({ message: 'Collection cleared successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
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
