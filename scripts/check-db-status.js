#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkTableExists(tableName) {
    const { data, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

    return !error || error.code !== '42P01'; // 42P01 = table does not exist
}

async function getTableCount(tableName) {
    const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

    if (error) return null;
    return count;
}

async function main() {
    console.log('🔍 Verificando estado de la base de datos...\n');

    // Check old schema
    console.log('📊 Esquema ACTUAL (duplicado):');
    const cardsExists = await checkTableExists('cards');
    console.log(`  - Tabla 'cards': ${cardsExists ? '✅ Existe' : '❌ No existe'}`);
    if (cardsExists) {
        const count = await getTableCount('cards');
        console.log(`    Registros: ${count !== null ? count : 'N/A'}`);
    }

    const adminsExists = await checkTableExists('admins');
    console.log(`  - Tabla 'admins': ${adminsExists ? '✅ Existe' : '❌ No existe'}`);
    if (adminsExists) {
        const count = await getTableCount('admins');
        console.log(`    Registros: ${count !== null ? count : 'N/A'}`);
    }

    console.log('\n📊 Esquema NORMALIZADO (nuevo):');
    const masterCardsExists = await checkTableExists('master_cards');
    console.log(`  - Tabla 'master_cards': ${masterCardsExists ? '✅ Existe' : '❌ No existe'}`);
    if (masterCardsExists) {
        const count = await getTableCount('master_cards');
        console.log(`    Registros: ${count !== null ? count : 'N/A'}`);
    }

    const userCollectionsExists = await checkTableExists('user_collections');
    console.log(`  - Tabla 'user_collections': ${userCollectionsExists ? '✅ Existe' : '❌ No existe'}`);
    if (userCollectionsExists) {
        const count = await getTableCount('user_collections');
        console.log(`    Registros: ${count !== null ? count : 'N/A'}`);
    }

    const userLimitsExists = await checkTableExists('user_limits');
    console.log(`  - Tabla 'user_limits': ${userLimitsExists ? '✅ Existe' : '❌ No existe'}`);
    if (userLimitsExists) {
        const count = await getTableCount('user_limits');
        console.log(`    Registros: ${count !== null ? count : 'N/A'}`);
    }

    console.log('\n📊 Tabla de backup:');
    const backupExists = await checkTableExists('cards_backup_old_schema');
    console.log(`  - Tabla 'cards_backup_old_schema': ${backupExists ? '✅ Existe' : '❌ No existe'}`);
    if (backupExists) {
        const count = await getTableCount('cards_backup_old_schema');
        console.log(`    Registros: ${count !== null ? count : 'N/A'}`);
    }

    // Recommendations
    console.log('\n💡 Recomendaciones:');
    if (!masterCardsExists && !userCollectionsExists && !userLimitsExists) {
        console.log('  ✨ Puedes aplicar la migración completa de forma segura');
        console.log('  📝 Ejecuta: Aplicar migrations/001_normalize_and_add_limits_FIXED.sql');
    } else if (masterCardsExists && userCollectionsExists && userLimitsExists) {
        console.log('  ✅ La migración ya fue aplicada');
        console.log('  🔄 Puedes proceder a actualizar server.js');
    } else {
        console.log('  ⚠️  Estado parcial detectado - revisa qué tablas faltan');
    }
}

main().catch(error => {
    console.error('Error:', error.message);
    process.exit(1);
});
