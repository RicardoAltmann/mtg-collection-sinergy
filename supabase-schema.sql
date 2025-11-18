-- Create the cards table in Supabase with user support
-- Go to your Supabase project → SQL Editor and run this:

-- Drop old table if exists (WARNING: This will delete all data!)
-- DROP TABLE IF EXISTS cards;

-- Create cards table with user_id
CREATE TABLE IF NOT EXISTS cards (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_card_name ON cards ((card_data->>'name'));
CREATE INDEX IF NOT EXISTS idx_user_id ON cards (user_id);

-- Enable Row Level Security
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see and modify their own cards
CREATE POLICY "Users can view their own cards" ON cards
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cards" ON cards
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cards" ON cards
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cards" ON cards
    FOR DELETE
    USING (auth.uid() = user_id);

-- ====================
-- ADMIN FUNCTIONALITY
-- ====================

-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id)
);

-- Create index for fast admin lookups
CREATE INDEX IF NOT EXISTS idx_admin_user_id ON admins (user_id);

-- Enable Row Level Security for admins table
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone authenticated can check if someone is admin (read-only)
CREATE POLICY "Anyone can view admins" ON admins
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- Policy: Only admins can grant admin privileges
CREATE POLICY "Only admins can insert admins" ON admins
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM admins WHERE user_id = auth.uid()
        )
    );

-- Policy: Only admins can revoke admin privileges
CREATE POLICY "Only admins can delete admins" ON admins
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM admins WHERE user_id = auth.uid()
        )
    );

-- Helper function to check if a user is admin
CREATE OR REPLACE FUNCTION is_admin(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM admins WHERE user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN is_admin(auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Additional policies for admins: Admins can view ALL cards
CREATE POLICY "Admins can view all cards" ON cards
    FOR SELECT
    USING (is_current_user_admin());

-- Additional policy: Admins can delete any card
CREATE POLICY "Admins can delete any card" ON cards
    FOR DELETE
    USING (is_current_user_admin());

-- =====================================================
-- NORMALIZED SCHEMA (Recommended for production)
-- =====================================================
-- This schema reduces storage by ~98.5% for popular cards
-- Use migrations/001_normalize_and_add_limits_FIXED.sql to migrate

-- Master cards table - stores each unique card once
CREATE TABLE IF NOT EXISTS master_cards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    card_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_cards_name ON master_cards (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_master_cards_updated ON master_cards (updated_at);

COMMENT ON TABLE master_cards IS 'Stores each unique MTG card once - avoids duplication across users';

-- User collections table - N:N relationship between users and cards
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

COMMENT ON TABLE user_collections IS 'N:N relationship between users and cards - only references, no duplication';

-- User limits table - custom card limits per user
CREATE TABLE IF NOT EXISTS user_limits (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    max_cards INTEGER NOT NULL DEFAULT 500,
    custom_limit_reason TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_limits_max_cards ON user_limits (max_cards);

COMMENT ON TABLE user_limits IS 'Custom card limits per user (default: 500)';

-- ====================
-- RLS for new tables
-- ====================

ALTER TABLE master_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view master cards" ON master_cards
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- RLS for user_collections
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

-- RLS for user_limits
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

-- ====================
-- Helper functions
-- ====================

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

-- ====================
-- ADMIN AUDIT LOG
-- ====================

-- Create admin audit log table
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL,
    target_user_id UUID REFERENCES auth.users(id),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_admin_user ON admin_audit_log (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_target_user ON admin_audit_log (target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON admin_audit_log (created_at DESC);

-- Enable Row Level Security
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON admin_audit_log
    FOR SELECT
    USING (is_current_user_admin());

-- Policy: Only admins can insert audit logs
CREATE POLICY "Admins can insert audit logs" ON admin_audit_log
    FOR INSERT
    WITH CHECK (is_current_user_admin());
