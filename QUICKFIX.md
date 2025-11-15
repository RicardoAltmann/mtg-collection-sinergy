# Quick Fix: "column user_id does not exist" Error

## Error Message
```
Error: Failed to run sql query: ERROR: 42703: column "user_id" does not exist
```

## Problem
Your Supabase database has the `cards` table but it's missing the `user_id` column required for user authentication.

## Quick Solution (Choose One)

### ✅ Solution 1: Fresh Database (No existing data to preserve)

**Best if**: You're setting up for the first time OR you don't have important card data

**Steps**:
1. Open your Supabase project: https://app.supabase.com
2. Go to **SQL Editor** (left sidebar)
3. Click **New Query**
4. Copy and paste the entire contents of `supabase-schema.sql`
5. Click **Run** (or press Ctrl+Enter)
6. Refresh your application

**What this does**: Recreates the cards table with the correct schema including `user_id`.

---

### ✅ Solution 2: Preserve Existing Data

**Best if**: You have existing card data you want to keep

**Steps**:

#### Part 1: Add the column
1. Open your Supabase project: https://app.supabase.com
2. Go to **SQL Editor** → **New Query**
3. Run this first:
```sql
ALTER TABLE cards ADD COLUMN IF NOT EXISTS user_id UUID;
```

#### Part 2: Get your user ID
```sql
SELECT id, email FROM auth.users;
```
Copy the `id` value (looks like: `123e4567-e89b-12d3-a456-426614174000`)

#### Part 3: Assign existing cards to your user
```sql
-- Replace YOUR-USER-ID-HERE with the ID from Part 2
UPDATE cards SET user_id = 'YOUR-USER-ID-HERE' WHERE user_id IS NULL;
```

#### Part 4: Complete the migration
Copy and paste the entire contents of `migration-add-user-id.sql` and run it.

---

## Verification

After running the migration, verify it worked:

```sql
-- Check the table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'cards';
```

You should see `user_id` with type `uuid` and `is_nullable = NO`.

---

## Still Having Issues?

### Check 1: Do you have users?
```sql
SELECT COUNT(*) FROM auth.users;
```
If this returns 0, you need to create a user account first by signing up through your app.

### Check 2: Is the table created?
```sql
SELECT table_name FROM information_schema.tables WHERE table_name = 'cards';
```
If this returns no rows, the table doesn't exist. Use Solution 1 above.

### Check 3: Review RLS Policies
```sql
SELECT * FROM pg_policies WHERE tablename = 'cards';
```
You should see policies for SELECT, INSERT, UPDATE, and DELETE.

---

## Prevention

To avoid this in the future when setting up new Supabase projects:
1. Always run `supabase-schema.sql` first before starting the application
2. See `DEPLOYMENT.md` for complete deployment instructions

---

## Technical Details

The application requires `user_id` to:
- Associate each card with a specific user
- Enable Row Level Security (RLS) for data isolation
- Prevent users from seeing each other's collections

**Files involved**:
- `server.js:73` - Loads user's cards: `.eq('user_id', user.id)`
- `server.js:95` - Deletes user's cards: `.eq('user_id', user.id)`
- `server.js:99,119` - Inserts cards with `user_id: user.id`
