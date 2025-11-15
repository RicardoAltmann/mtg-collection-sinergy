-- ═══════════════════════════════════════════════════════════════
-- INSTRUCCIONES:
-- 1. Abre https://app.supabase.com
-- 2. Selecciona tu proyecto
-- 3. En el menú izquierdo: SQL Editor → New Query
-- 4. COPIA TODO ESTE ARCHIVO y pégalo ahí
-- 5. Presiona RUN (o Ctrl+Enter)
-- 6. Espera a que diga "Success"
-- 7. Cierra y vuelve a intentar tu aplicación
-- ═══════════════════════════════════════════════════════════════

-- Borrar tabla vieja si existe (esto elimina todos los datos)
DROP TABLE IF EXISTS cards CASCADE;

-- Crear la tabla con la estructura correcta
CREATE TABLE cards (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_card_name ON cards ((card_data->>'name'));
CREATE INDEX idx_user_id ON cards (user_id);

-- Activar seguridad por usuario (RLS)
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Políticas: cada usuario solo ve sus propias cartas
CREATE POLICY "Users can view their own cards" ON cards
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cards" ON cards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cards" ON cards
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cards" ON cards
    FOR DELETE USING (auth.uid() = user_id);

-- Verificar que todo está bien
SELECT 'TABLA CREADA EXITOSAMENTE' as status,
       column_name,
       data_type,
       is_nullable
FROM information_schema.columns
WHERE table_name = 'cards'
ORDER BY ordinal_position;
