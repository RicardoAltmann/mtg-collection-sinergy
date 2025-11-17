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
