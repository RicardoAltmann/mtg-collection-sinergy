-- ============================================
-- PASO 1: Verifica si la tabla existe
-- ============================================
-- Ejecuta esto primero para ver qué tienes:

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cards'
ORDER BY ordinal_position;

-- Si NO aparece nada, significa que la tabla no existe.
-- Si aparece algo pero no está "user_id", necesitas agregar la columna.

-- ============================================
-- PASO 2A: Si la tabla NO EXISTE (ejecuta esto)
-- ============================================

CREATE TABLE IF NOT EXISTS cards (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_name ON cards ((card_data->>'name'));
CREATE INDEX IF NOT EXISTS idx_user_id ON cards (user_id);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own cards" ON cards;
DROP POLICY IF EXISTS "Users can insert their own cards" ON cards;
DROP POLICY IF EXISTS "Users can update their own cards" ON cards;
DROP POLICY IF EXISTS "Users can delete their own cards" ON cards;

CREATE POLICY "Users can view their own cards" ON cards
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cards" ON cards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cards" ON cards
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cards" ON cards
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- PASO 2B: Si la tabla EXISTE pero le falta user_id
-- ============================================
-- Solo ejecuta esto si en el PASO 1 viste que la tabla existe pero no tiene user_id

-- Agregar la columna
ALTER TABLE cards ADD COLUMN IF NOT EXISTS user_id UUID;

-- Verificar si tienes filas existentes
SELECT COUNT(*) as total_rows FROM cards;

-- Si tienes filas, necesitas asignarles un user_id
-- Opción 1: Ver tu user ID
SELECT id, email FROM auth.users LIMIT 1;

-- Opción 2: Asignar todas las cartas existentes a tu usuario
-- REEMPLAZA 'TU-USER-ID-AQUI' con el ID del SELECT anterior
-- UPDATE cards SET user_id = 'TU-USER-ID-AQUI' WHERE user_id IS NULL;

-- Opción 3: Borrar las cartas existentes si no son importantes
-- DELETE FROM cards WHERE user_id IS NULL;

-- Después de elegir Opción 2 o 3, ejecuta esto:
ALTER TABLE cards ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_user_id_fkey;
ALTER TABLE cards ADD CONSTRAINT cards_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own cards" ON cards;
DROP POLICY IF EXISTS "Users can insert their own cards" ON cards;
DROP POLICY IF EXISTS "Users can update their own cards" ON cards;
DROP POLICY IF EXISTS "Users can delete their own cards" ON cards;

CREATE POLICY "Users can view their own cards" ON cards
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cards" ON cards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cards" ON cards
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cards" ON cards
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- PASO 3: Verificación final
-- ============================================
-- Ejecuta esto al final para confirmar que todo está bien:

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'cards'
ORDER BY ordinal_position;

-- Deberías ver:
-- id          | bigint | NO   | nextval(...)
-- user_id     | uuid   | NO   | (null)
-- card_data   | jsonb  | NO   | (null)
-- created_at  | timestamp with time zone | YES | now()
