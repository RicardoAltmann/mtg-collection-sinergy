#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

const BULK_METADATA_URL = 'https://api.scryfall.com/bulk-data/default_cards';
const TOP_CARDS_LIMIT = 10000;
const UPSERT_BATCH_SIZE = 500;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
}

const PROXY_URL = process.env.https_proxy || process.env.HTTPS_PROXY ||
    process.env.http_proxy || process.env.HTTP_PROXY;
const proxyAgent = PROXY_URL ? new ProxyAgent(PROXY_URL) : null;

if (proxyAgent) {
    console.log('Using proxy for Scryfall downloads');
    setGlobalDispatcher(proxyAgent);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

async function fetchBulkCards() {
    console.log('Fetching bulk metadata from Scryfall...');
    const metadataResponse = await fetch(BULK_METADATA_URL, {
        headers: {
            'User-Agent': 'MTG-Collection-Synergy/seed-script'
        }
    });

    if (!metadataResponse.ok) {
        throw new Error(`Failed to load bulk metadata: HTTP ${metadataResponse.status}`);
    }

    const metadata = await metadataResponse.json();
    const downloadUrl = metadata.download_uri;

    if (!downloadUrl) {
        throw new Error('Scryfall bulk metadata missing download_uri');
    }

    console.log('Downloading card catalog from Scryfall...');
    const dataResponse = await fetch(downloadUrl, {
        headers: {
            'User-Agent': 'MTG-Collection-Synergy/seed-script'
        }
    });

    if (!dataResponse.ok) {
        throw new Error(`Failed to download bulk data: HTTP ${dataResponse.status}`);
    }

    const cards = await dataResponse.json();
    console.log(`Bulk download complete: ${cards.length} cards`);
    return cards;
}

function pickTopCards(cards) {
    const ranked = cards
        .filter(card => typeof card.edhrec_rank === 'number')
        .sort((a, b) => {
            const rankDiff = a.edhrec_rank - b.edhrec_rank;
            return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
        })
        .slice(0, TOP_CARDS_LIMIT);

    console.log(`Selected top ${ranked.length} cards by EDHRec rank`);
    return ranked;
}

async function upsertMasterCards(cards) {
    let inserted = 0;
    for (let i = 0; i < cards.length; i += UPSERT_BATCH_SIZE) {
        const batch = cards.slice(i, i + UPSERT_BATCH_SIZE).map(card => ({
            id: card.id,
            name: card.name,
            card_data: optimizeCardData(card),
            updated_at: new Date().toISOString()
        }));

        const { error } = await supabase
            .from('master_cards')
            .upsert(batch, { onConflict: 'id', ignoreDuplicates: false });

        if (error) {
            console.error('Batch upsert failed:', error.message);
            throw error;
        }

        inserted += batch.length;
        console.log(`Upserted ${inserted}/${cards.length} master cards...`);
    }
}

async function main() {
    try {
        const bulkCards = await fetchBulkCards();
        const topCards = pickTopCards(bulkCards);
        await upsertMasterCards(topCards);
        console.log('Master card cache updated successfully');
    } catch (error) {
        console.error('Seed failed:', error.message);
        process.exitCode = 1;
    }
}

main();
