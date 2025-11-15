-- Quick Migration: Fresh Start (DELETES ALL DATA)
-- Use this if you want to recreate the cards table from scratch
-- WARNING: This will delete all existing card data!

-- Drop existing table and recreate with new schema
DROP TABLE IF EXISTS cards;

CREATE TABLE IF NOT EXISTS cards (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);

-- Enable Row Level Security
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own cards" ON cards
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cards" ON cards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cards" ON cards
    FOR DELETE USING (auth.uid() = user_id);
