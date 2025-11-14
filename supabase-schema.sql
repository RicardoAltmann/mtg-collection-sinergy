-- Create the cards table in Supabase
-- Go to your Supabase project → SQL Editor and run this:

CREATE TABLE IF NOT EXISTS cards (
    id BIGSERIAL PRIMARY KEY,
    card_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on the card name for faster lookups
CREATE INDEX IF NOT EXISTS idx_card_name ON cards ((card_data->>'name'));

-- Enable Row Level Security (optional, but recommended)
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anonymous users (adjust based on your needs)
CREATE POLICY "Allow all operations" ON cards
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);
