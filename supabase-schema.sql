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
