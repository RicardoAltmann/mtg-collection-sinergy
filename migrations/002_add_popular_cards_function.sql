-- =====================================================
-- Helper function: Get most popular cards
-- =====================================================
-- Returns the N cards that appear in the most user collections

CREATE OR REPLACE FUNCTION get_popular_cards(top_n INTEGER DEFAULT 10)
RETURNS TABLE (
    card_id TEXT,
    card_name TEXT,
    num_users BIGINT,
    card_data JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        mc.id AS card_id,
        mc.name AS card_name,
        COUNT(DISTINCT uc.user_id) AS num_users,
        mc.card_data
    FROM master_cards mc
    JOIN user_collections uc ON mc.id = uc.card_id
    GROUP BY mc.id, mc.name, mc.card_data
    ORDER BY num_users DESC, mc.name ASC
    LIMIT top_n;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_popular_cards IS 'Returns the N most popular cards across all user collections';
