# Database Migration Guide

## Error: column "user_id" does not exist

If you're seeing this error, it means your database needs to be migrated to support the new user authentication system.

## Migration Options

### Option 1: Fresh Start (Recommended if you have no important data)

**⚠️ WARNING: This will delete all existing card data!**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the contents of `migration-fresh-start.sql`

This will recreate the cards table with the correct schema including the `user_id` column.

### Option 2: Preserve Existing Data

If you have existing card data you want to keep, use the `migration-add-user-id.sql` script:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the contents of `migration-add-user-id.sql`
4. The script will pause and ask you to choose how to handle existing data:
   - **Option A**: Delete existing rows (uncomment the DELETE statement)
   - **Option B**: Assign existing rows to a specific user (uncomment and update the UPDATE statement with your user UUID)

To get your user UUID:
```sql
SELECT id FROM auth.users LIMIT 1;
```

Then replace `'YOUR-USER-UUID-HERE'` in the UPDATE statement with the actual UUID.

5. After choosing Option A or B, run the rest of the script

## What Changed?

The application was updated to include user authentication. Each card is now associated with a specific user, allowing:
- Users to only see their own cards
- Secure data isolation between users
- Proper authentication and authorization

## Schema Changes

**Before:**
```sql
CREATE TABLE cards (
    id BIGSERIAL PRIMARY KEY,
    card_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**After:**
```sql
CREATE TABLE cards (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Need Help?

If you encounter issues during migration, check:
1. You're logged into Supabase as the project owner
2. Your Supabase project has the Authentication feature enabled
3. You have at least one user created in the auth.users table
