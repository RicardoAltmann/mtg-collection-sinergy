import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const SCRYFALL_API = 'https://api.scryfall.com';
const COLLECTION_FILE = path.join(__dirname, 'collection.json');

// Middleware
app.use(cors());
app.use(express.json());

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

// Load collection from file
async function loadCollection() {
    try {
        const data = await fs.readFile(COLLECTION_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist, return empty collection
        return [];
    }
}

// Save collection to file
async function saveCollection(collection) {
    await fs.writeFile(COLLECTION_FILE, JSON.stringify(collection, null, 2));
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
        const collection = await loadCollection();
        res.json(collection);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add cards to collection
app.post('/api/collection', async (req, res) => {
    try {
        const { cardNames } = req.body;

        if (!Array.isArray(cardNames)) {
            return res.status(400).json({ error: 'cardNames must be an array' });
        }

        const collection = await loadCollection();
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
                    collection.push(data);
                    results.push(data.name);
                } else {
                    errors.push(cardName);
                }
            } catch (error) {
                errors.push(cardName);
            }
        }

        await saveCollection(collection);

        res.json({
            added: results,
            errors,
            skipped,
            totalInCollection: collection.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove a card from collection
app.delete('/api/collection/:name', async (req, res) => {
    try {
        const cardName = req.params.name.toLowerCase();
        const collection = await loadCollection();

        const filteredCollection = collection.filter(card =>
            card.name.toLowerCase() !== cardName
        );

        if (filteredCollection.length === collection.length) {
            return res.status(404).json({ error: 'Card not found in collection' });
        }

        await saveCollection(filteredCollection);

        res.json({
            message: 'Card removed successfully',
            totalInCollection: filteredCollection.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Clear entire collection
app.delete('/api/collection', async (req, res) => {
    try {
        await saveCollection([]);
        res.json({ message: 'Collection cleared successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🎴 MTG Synergy Analyzer running on http://localhost:${PORT}`);
    console.log(`📊 Collection file: ${COLLECTION_FILE}`);
});
