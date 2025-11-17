-- =====================================================
-- MIGRATION: Normalización de cartas + Límites por usuario (CORREGIDA)
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
CREATE TABLE IF NOT EXISTS master_cards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    card_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_cards_name ON master_cards (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_master_cards_updated ON master_cards (updated_at);

COMMENT ON TABLE master_cards IS 'Almacena cada carta única del universo MTG una sola vez';

-- =====================================================
-- PASO 2: Crear tabla de colecciones de usuario (relaciones)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_collections (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL REFERENCES master_cards(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_user_collections_user_id ON user_collections (user_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_card_id ON user_collections (card_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_added_at ON user_collections (user_id, added_at DESC);

COMMENT ON TABLE user_collections IS 'Relación N:N entre usuarios y cartas - solo referencias, sin duplicación';

-- =====================================================
-- PASO 3: Crear tabla de límites por usuario
-- =====================================================
CREATE TABLE IF NOT EXISTS user_limits (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    max_cards INTEGER NOT NULL DEFAULT 500,
    custom_limit_reason TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_limits_max_cards ON user_limits (max_cards);

COMMENT ON TABLE user_limits IS 'Límites personalizados de cartas por usuario (default: 500)';

-- =====================================================
-- PASO 4: Migrar datos existentes (si existen)
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

ALTER TABLE master_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view master cards" ON master_cards
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only system can insert master cards" ON master_cards
    FOR INSERT
    WITH CHECK (false);

-- RLS para user_collections
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

CREATE OR REPLACE FUNCTION get_user_card_limit(check_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(
        (SELECT max_cards FROM user_limits WHERE user_id = check_user_id),
        500
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

ALTER VIEW user_collection_with_cards SET (security_invoker = true);

-- =====================================================
-- PASO 7: Función de optimización JSONB
-- =====================================================

CREATE OR REPLACE FUNCTION optimize_card_data(full_card_data JSONB)
RETURNS JSONB AS $$
BEGIN
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

-- =====================================================
-- PASO 8: Renombrar tabla antigua (no borrar aún)
-- =====================================================

ALTER TABLE IF EXISTS cards RENAME TO cards_backup_old_schema;
ALTER TABLE IF EXISTS cards_backup_old_schema DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- PASO 9: Estadísticas y verificación
-- =====================================================

DO $$
DECLARE
    old_size BIGINT;
    new_size BIGINT;
    savings NUMERIC;
    savings_text TEXT;
BEGIN
    SELECT pg_total_relation_size('cards_backup_old_schema') INTO old_size;
    SELECT pg_total_relation_size('master_cards') + pg_total_relation_size('user_collections') INTO new_size;

    IF old_size > 0 THEN
        savings := ((old_size - new_size)::NUMERIC / old_size * 100);
        savings_text := ROUND(savings, 2)::TEXT || '%';
    ELSE
        savings_text := 'N/A (no previous data)';
    END IF;

    RAISE NOTICE '===== MIGRATION COMPLETE =====';
    RAISE NOTICE 'Old schema size: % KB', (old_size / 1024);
    RAISE NOTICE 'New schema size: % KB', (new_size / 1024);
    RAISE NOTICE 'Space savings: %', savings_text;
    RAISE NOTICE '==============================';
END $$;

COMMIT;

-- =====================================================
-- Verificación post-migración
-- =====================================================

-- Descomentar para verificar:
-- SELECT COUNT(*) as unique_cards FROM master_cards;
-- SELECT COUNT(*) as total_collections FROM user_collections;
-- SELECT COUNT(*) as users_with_limits FROM user_limits;
