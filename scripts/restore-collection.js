#!/usr/bin/env node

/**
 * Script para recuperar cartas de colección desde la tabla de backup
 *
 * Este script recupera las cartas que fueron migradas a la tabla
 * cards_backup_old_schema y las restaura en el nuevo esquema normalizado.
 *
 * Usage:
 *   node scripts/restore-collection.js [email]
 *
 * You must provide an email as the first argument
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_EMAIL = process.env.ADMIN_EMAIL || null;

async function restoreCollection() {
    // Validar variables de entorno
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ Error: Faltan variables de entorno requeridas');
        console.error('Por favor configura SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu archivo .env');
        console.error('\nPuedes encontrar el service role key en:');
        console.error('Supabase Dashboard → Settings → API → service_role (secret)');
        process.exit(1);
    }

    // Obtener email del argumento o usar default
    const targetEmail = process.argv[2] || DEFAULT_EMAIL;

    if (!targetEmail) {
        console.error('❌ Error: Email es requerido');
        console.error('Uso: node scripts/restore-collection.js tu-email@ejemplo.com');
        console.error('O configura ADMIN_EMAIL en tu archivo .env');
        process.exit(1);
    }

    console.log('🔧 Iniciando recuperación de colección...');
    console.log(`📧 Email del usuario: ${targetEmail}`);
    console.log('');

    // Crear cliente admin (usa service role key para operaciones administrativas)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // Paso 1: Buscar usuario por email
        console.log('🔍 Buscando usuario...');
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

        if (listError) {
            throw new Error(`Error al listar usuarios: ${listError.message}`);
        }

        const targetUser = users.find(u => u.email === targetEmail);

        if (!targetUser) {
            console.error(`❌ Usuario no encontrado: ${targetEmail}`);
            console.error('\nAsegúrate de que el usuario se haya registrado primero.');
            console.error('Usuarios disponibles:');
            users.forEach(u => console.error(`  - ${u.email} (${u.id})`));
            process.exit(1);
        }

        console.log(`✓ Usuario encontrado: ${targetUser.email}`);
        console.log(`  User ID: ${targetUser.id}`);
        console.log('');

        // Paso 2: Verificar si existe la tabla de backup
        console.log('🔍 Verificando tabla de backup...');
        const { data: backupCards, error: backupError } = await supabase
            .rpc('check_backup_table_exists');

        // Si no existe la función RPC, intentamos directamente con la tabla
        // Nota: Necesitamos ejecutar SQL directo para acceder a cards_backup_old_schema
        console.log('⚠️  Nota: Este script requiere acceso directo a la base de datos');
        console.log('   Para recuperar las cartas desde cards_backup_old_schema,');
        console.log('   necesitas ejecutar el siguiente SQL en Supabase SQL Editor:');
        console.log('');
        console.log('===== COPIAR Y EJECUTAR EN SUPABASE SQL EDITOR =====');
        console.log('');
        console.log(`-- 1. Verificar cuántas cartas hay en el backup para el usuario`);
        console.log(`SELECT COUNT(*) as total_cards`);
        console.log(`FROM cards_backup_old_schema`);
        console.log(`WHERE user_id = '${targetUser.id}';`);
        console.log('');
        console.log(`-- 2. Ver las primeras 5 cartas del backup`);
        console.log(`SELECT card_data->>'name' as card_name, created_at`);
        console.log(`FROM cards_backup_old_schema`);
        console.log(`WHERE user_id = '${targetUser.id}'`);
        console.log(`ORDER BY created_at DESC`);
        console.log(`LIMIT 5;`);
        console.log('');
        console.log(`-- 3. RECUPERAR TODAS LAS CARTAS DEL BACKUP`);
        console.log(`-- Este script restaura las cartas a las nuevas tablas`);
        console.log(`DO $$`);
        console.log(`DECLARE`);
        console.log(`    cards_restored INTEGER := 0;`);
        console.log(`    new_cards INTEGER := 0;`);
        console.log(`BEGIN`);
        console.log(`    -- Insertar cartas únicas en master_cards`);
        console.log(`    INSERT INTO master_cards (id, name, card_data, created_at)`);
        console.log(`    SELECT DISTINCT ON (card_data->>'id')`);
        console.log(`        card_data->>'id' AS id,`);
        console.log(`        card_data->>'name' AS name,`);
        console.log(`        card_data,`);
        console.log(`        MIN(created_at) AS created_at`);
        console.log(`    FROM cards_backup_old_schema`);
        console.log(`    WHERE user_id = '${targetUser.id}'`);
        console.log(`      AND card_data->>'id' IS NOT NULL`);
        console.log(`    GROUP BY card_data->>'id', card_data->>'name', card_data`);
        console.log(`    ON CONFLICT (id) DO NOTHING;`);
        console.log(``);
        console.log(`    GET DIAGNOSTICS new_cards = ROW_COUNT;`);
        console.log(``);
        console.log(`    -- Insertar relaciones en user_collections`);
        console.log(`    INSERT INTO user_collections (user_id, card_id, added_at)`);
        console.log(`    SELECT`);
        console.log(`        user_id,`);
        console.log(`        card_data->>'id' AS card_id,`);
        console.log(`        created_at`);
        console.log(`    FROM cards_backup_old_schema`);
        console.log(`    WHERE user_id = '${targetUser.id}'`);
        console.log(`      AND card_data->>'id' IS NOT NULL`);
        console.log(`    ON CONFLICT (user_id, card_id) DO NOTHING;`);
        console.log(``);
        console.log(`    GET DIAGNOSTICS cards_restored = ROW_COUNT;`);
        console.log(``);
        console.log(`    -- Inicializar límites si no existen`);
        console.log(`    INSERT INTO user_limits (user_id, max_cards)`);
        console.log(`    VALUES ('${targetUser.id}', 500)`);
        console.log(`    ON CONFLICT (user_id) DO NOTHING;`);
        console.log(``);
        console.log(`    RAISE NOTICE '===== RECUPERACIÓN COMPLETADA =====';\n    RAISE NOTICE 'Cartas únicas añadidas a master_cards: %', new_cards;`);
        console.log(`    RAISE NOTICE 'Cartas restauradas a tu colección: %', cards_restored;`);
        console.log(`    RAISE NOTICE '================================';`);
        console.log(`END $$;`);
        console.log('');
        console.log(`-- 4. Verificar la recuperación`);
        console.log(`SELECT COUNT(*) as total_cards_in_collection`);
        console.log(`FROM user_collections`);
        console.log(`WHERE user_id = '${targetUser.id}';`);
        console.log('');
        console.log('====================================================');
        console.log('');
        console.log('📋 Instrucciones:');
        console.log('1. Copia el SQL de arriba');
        console.log('2. Ve a tu proyecto de Supabase');
        console.log('3. Abre el SQL Editor');
        console.log('4. Pega y ejecuta el script');
        console.log('5. Verifica los resultados en los mensajes de NOTICE');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('❌ Error:', error.message);
        console.error('');
        process.exit(1);
    }
}

restoreCollection();
