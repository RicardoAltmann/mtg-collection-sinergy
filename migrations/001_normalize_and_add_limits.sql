-- =====================================================
-- MIGRATION: Normalización de cartas + Límites por usuario
-- =====================================================
-- Este script convierte el esquema actual de duplicación
-- a un esquema normalizado donde cada carta se guarda una sola vez.
--
-- ANTES: 100 usuarios con "Sol Ring" = 100 filas × 8KB = 800KB
-- DESPUÉS: 1 fila de carta + 100 relaciones = ~8KB + 4KB = 12KB
-- AHORRO: ~98.5% de espacio para cartas populares
-- =====================================================

BEGIN;

-- =====================================================
-- PASO 1: Crear tabla de cartas maestras (únicas)
-- =====================================================
-- Esta tabla contendrá cada carta única UNA SOLA VEZ
-- usando el Scryfall ID como clave primaria

CREATE TABLE IF NOT EXISTS master_cards (
    id TEXT PRIMARY KEY,                      -- Scryfall ID (e.g., "f9e06da9-c0b0-43aa-8bee-c5d5e6fd542b")
    name TEXT NOT NULL,                       -- Card name for quick lookups
    card_data JSONB NOT NULL,                 -- Full Scryfall object
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_master_cards_name ON master_cards (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_master_cards_updated ON master_cards (updated_at);

COMMENT ON TABLE master_cards IS 'Almacena cada carta única del universo MTG una sola vez';
COMMENT ON COLUMN master_cards.id IS 'Scryfall UUID - identificador único de cada carta';
COMMENT ON COLUMN master_cards.card_data IS 'Objeto completo de Scryfall API optimizado (solo campos necesarios)';

-- =====================================================
-- PASO 2: Crear tabla de colecciones de usuario (relaciones)
-- =====================================================
-- Esta tabla solo almacena referencias (user_id + card_id)
-- En lugar de duplicar todo el objeto JSON

CREATE TABLE IF NOT EXISTS user_collections (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL REFERENCES master_cards(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraint para prevenir duplicados en la colección
    UNIQUE(user_id, card_id)
);

-- Índices para queries eficientes
CREATE INDEX IF NOT EXISTS idx_user_collections_user_id ON user_collections (user_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_card_id ON user_collections (card_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_added_at ON user_collections (user_id, added_at DESC);

COMMENT ON TABLE user_collections IS 'Relación N:N entre usuarios y cartas - solo referencias, sin duplicación';
COMMENT ON COLUMN user_collections.added_at IS 'Timestamp de cuándo el usuario agregó la carta (para ordenar cronológicamente)';

-- =====================================================
-- PASO 3: Crear tabla de límites por usuario
-- =====================================================
-- Permite configurar límites personalizados por usuario
-- Por defecto: 500 cartas, pero admins pueden aumentarlo

CREATE TABLE IF NOT EXISTS user_limits (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    max_cards INTEGER NOT NULL DEFAULT 500,
    custom_limit_reason TEXT,                  -- Por qué se le dio un límite especial
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)  -- Qué admin modificó el límite
);

CREATE INDEX IF NOT EXISTS idx_user_limits_max_cards ON user_limits (max_cards);

COMMENT ON TABLE user_limits IS 'Límites personalizados de cartas por usuario (default: 500)';
COMMENT ON COLUMN user_limits.max_cards IS 'Máximo de cartas que este usuario puede tener en su colección';
COMMENT ON COLUMN user_limits.custom_limit_reason IS 'Razón por la cual se modificó el límite (e.g., "Premium user", "Beta tester")';

-- =====================================================
-- PASO 4: Migrar datos existentes
-- =====================================================
-- Convertir las cartas actuales duplicadas a la nueva estructura

-- 4.1: Extraer cartas únicas a master_cards
INSERT INTO master_cards (id, name, card_data, created_at)
SELECT DISTINCT ON (card_data->>'id')
    card_data->>'id' AS id,
    card_data->>'name' AS name,
    card_data,
    MIN(created_at) AS created_at
FROM cards
WHERE card_data->>'id' IS NOT NULL
GROUP BY card_data->>'id', card_data->>'name', card_data
ON CONFLICT (id) DO NOTHING;

-- 4.2: Crear relaciones en user_collections
INSERT INTO user_collections (user_id, card_id, added_at)
SELECT
    c.user_id,
    c.card_data->>'id' AS card_id,
    c.created_at
FROM cards c
WHERE c.card_data->>'id' IS NOT NULL
ON CONFLICT (user_id, card_id) DO NOTHING;

-- 4.3: Inicializar límites para usuarios existentes
INSERT INTO user_limits (user_id, max_cards)
SELECT DISTINCT user_id, 500
FROM cards
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- PASO 5: Row Level Security (RLS) para nuevas tablas
-- =====================================================

-- RLS para master_cards (lectura pública, escritura restringida)
ALTER TABLE master_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view master cards" ON master_cards
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only system can insert master cards" ON master_cards
    FOR INSERT
    WITH CHECK (false); -- Solo el backend puede insertar vía SQL directo

-- RLS para user_collections (usuarios solo ven sus colecciones)
ALTER TABLE user_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own collections" ON user_collections
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their own collections" ON user_collections
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove from their own collections" ON user_collections
    FOR DELETE
    USING (auth.uid() = user_id);

-- Admins pueden ver todas las colecciones
CREATE POLICY "Admins can view all collections" ON user_collections
    FOR SELECT
    USING (is_current_user_admin());

CREATE POLICY "Admins can delete from any collection" ON user_collections
    FOR DELETE
    USING (is_current_user_admin());

-- RLS para user_limits
ALTER TABLE user_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own limits" ON user_limits
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all limits" ON user_limits
    FOR SELECT
    USING (is_current_user_admin());

CREATE POLICY "Admins can update limits" ON user_limits
    FOR UPDATE
    USING (is_current_user_admin());

CREATE POLICY "Admins can insert limits" ON user_limits
    FOR INSERT
    WITH CHECK (is_current_user_admin());

-- =====================================================
-- PASO 6: Funciones helper para el backend
-- =====================================================

-- Función para obtener el límite de un usuario
CREATE OR REPLACE FUNCTION get_user_card_limit(check_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(
        (SELECT max_cards FROM user_limits WHERE user_id = check_user_id),
        500  -- Default si no tiene límite personalizado
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para contar cartas de un usuario
CREATE OR REPLACE FUNCTION get_user_card_count(check_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM user_collections
        WHERE user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar si un usuario puede agregar N cartas
CREATE OR REPLACE FUNCTION can_user_add_cards(check_user_id UUID, num_cards INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
    user_limit INTEGER;
BEGIN
    current_count := get_user_card_count(check_user_id);
    user_limit := get_user_card_limit(check_user_id);

    RETURN (current_count + num_cards) <= user_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vista para facilitar queries (JOIN automático)
CREATE OR REPLACE VIEW user_collection_with_cards AS
SELECT
    uc.user_id,
    uc.id AS collection_id,
    uc.added_at,
    mc.id AS card_id,
    mc.name AS card_name,
    mc.card_data
FROM user_collections uc
JOIN master_cards mc ON uc.card_id = mc.id;

-- RLS para la vista
ALTER VIEW user_collection_with_cards SET (security_invoker = true);

COMMENT ON VIEW user_collection_with_cards IS 'Vista conveniente que une colecciones con datos completos de cartas';

-- =====================================================
-- PASO 7: Optimización del almacenamiento JSONB
-- =====================================================
-- Función para limpiar/optimizar el JSONB de Scryfall
-- Solo guardamos los campos que realmente usamos

CREATE OR REPLACE FUNCTION optimize_card_data(full_card_data JSONB)
RETURNS JSONB AS $$
BEGIN
    -- Retornar solo los campos necesarios para la app
    RETURN jsonb_build_object(
        'id', full_card_data->>'id',
        'name', full_card_data->>'name',
        'mana_cost', full_card_data->>'mana_cost',
        'cmc', full_card_data->>'cmc',
        'type_line', full_card_data->>'type_line',
        'oracle_text', full_card_data->>'oracle_text',
        'colors', full_card_data->'colors',
        'color_identity', full_card_data->'color_identity',
        'keywords', full_card_data->'keywords',
        'legalities', full_card_data->'legalities',
        'set', full_card_data->>'set',
        'set_name', full_card_data->>'set_name',
        'rarity', full_card_data->>'rarity',
        'image_uris', full_card_data->'image_uris',
        'prices', full_card_data->'prices',
        'scryfall_uri', full_card_data->>'scryfall_uri',
        'edhrec_rank', full_card_data->>'edhrec_rank'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION optimize_card_data IS 'Reduce el JSONB de Scryfall de ~8KB a ~2-3KB eliminando campos innecesarios';

-- =====================================================
-- PASO 8: Renombrar tabla antigua (no borrar aún)
-- =====================================================
-- Por seguridad, renombramos en lugar de borrar
-- Después de verificar que todo funciona, se puede eliminar

ALTER TABLE IF EXISTS cards RENAME TO cards_backup_old_schema;

-- Deshabilitar RLS en la tabla vieja para que no interfiera
ALTER TABLE IF EXISTS cards_backup_old_schema DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE cards_backup_old_schema IS 'DEPRECATED - Esquema antiguo con duplicación. Borrar después de verificar migración.';

-- =====================================================
-- PASO 9: Estadísticas y verificación
-- =====================================================

-- Ver ahorro de espacio
DO $$
DECLARE
    old_size BIGINT;
    new_size BIGINT;
    savings NUMERIC;
BEGIN
    -- Tamaño aproximado del esquema antiguo
    SELECT pg_total_relation_size('cards_backup_old_schema') INTO old_size;

    -- Tamaño del nuevo esquema
    SELECT pg_total_relation_size('master_cards') +
           pg_total_relation_size('user_collections') INTO new_size;

    savings := ((old_size - new_size)::NUMERIC / old_size * 100);

    RAISE NOTICE '===== MIGRATION COMPLETE =====';
    RAISE NOTICE 'Old schema size: % KB', (old_size / 1024);
    RAISE NOTICE 'New schema size: % KB', (new_size / 1024);
    RAISE NOTICE 'Space savings: %% ', ROUND(savings, 2);
    RAISE NOTICE '==============================';
END $$;

COMMIT;

-- =====================================================
-- QUERIES ÚTILES POST-MIGRACIÓN
-- =====================================================

-- Ver cartas más populares (más usuarios las tienen)
-- SELECT
--     mc.name,
--     COUNT(uc.user_id) AS num_users,
--     pg_size_pretty(pg_column_size(mc.card_data)) AS size_per_card
-- FROM master_cards mc
-- JOIN user_collections uc ON mc.id = uc.card_id
-- GROUP BY mc.id, mc.name
-- ORDER BY num_users DESC
-- LIMIT 20;

-- Ver usuarios cerca del límite
-- SELECT
--     au.email,
--     COUNT(uc.id) AS current_cards,
--     COALESCE(ul.max_cards, 500) AS limit,
--     ROUND((COUNT(uc.id)::NUMERIC / COALESCE(ul.max_cards, 500) * 100), 1) AS percent_used
-- FROM auth.users au
-- LEFT JOIN user_collections uc ON au.id = uc.user_id
-- LEFT JOIN user_limits ul ON au.id = ul.user_id
-- GROUP BY au.id, au.email, ul.max_cards
-- ORDER BY percent_used DESC;
