-- Migration: Add user_id column to cards table
-- This script safely migrates an existing cards table to include user authentication support
-- Run this in your Supabase SQL Editor if you have an existing cards table without user_id

-- Step 1: Add user_id column (nullable initially to allow existing rows)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'cards' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE cards ADD COLUMN user_id UUID;
        RAISE NOTICE 'Added user_id column to cards table';
    ELSE
        RAISE NOTICE 'user_id column already exists, skipping';
    END IF;
END $$;

-- Step 2: For existing rows without user_id, you have two options:

-- OPTION A: Delete existing rows (uncomment if you want to start fresh)
-- DELETE FROM cards WHERE user_id IS NULL;

-- OPTION B: Set a default user_id for existing rows (uncomment and replace with actual user UUID)
-- You can get a user UUID from auth.users table or create a system user
-- UPDATE cards SET user_id = 'YOUR-USER-UUID-HERE' WHERE user_id IS NULL;

-- Step 3: Make user_id NOT NULL and add foreign key constraint
-- Only run this AFTER handling existing NULL values above
DO $$
BEGIN
    -- Check if there are any NULL user_id values
    IF EXISTS (SELECT 1 FROM cards WHERE user_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot add NOT NULL constraint: cards table has rows with NULL user_id. Please delete them or assign a user_id first (see OPTION A or B above)';
    END IF;

    -- Add NOT NULL constraint
    ALTER TABLE cards ALTER COLUMN user_id SET NOT NULL;

    -- Add foreign key constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'cards_user_id_fkey' AND table_name = 'cards'
    ) THEN
        ALTER TABLE cards ADD CONSTRAINT cards_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint for user_id';
    END IF;
END $$;

-- Step 4: Create index on user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);

-- Step 5: Enable Row Level Security
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Users can view their own cards" ON cards;
DROP POLICY IF EXISTS "Users can insert their own cards" ON cards;
DROP POLICY IF EXISTS "Users can delete their own cards" ON cards;

-- Create RLS policies
CREATE POLICY "Users can view their own cards" ON cards
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cards" ON cards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cards" ON cards
    FOR DELETE USING (auth.uid() = user_id);

-- Migration complete!
RAISE NOTICE 'Migration completed successfully!';
