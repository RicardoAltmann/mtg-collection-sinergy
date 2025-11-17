#!/usr/bin/env node

/**
 * Script to grant admin privileges to the first administrator
 *
 * Usage:
 *   node scripts/make-first-admin.js [email]
 *
 * If no email is provided, defaults to ricardo.altmann@gmail.com
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_ADMIN_EMAIL = 'ricardo.altmann@gmail.com';

async function makeFirstAdmin() {
    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error('❌ Error: Missing required environment variables');
        console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
        console.error('\nYou can find the service role key in:');
        console.error('Supabase Dashboard → Settings → API → service_role (secret)');
        process.exit(1);
    }

    // Get email from command line or use default
    const targetEmail = process.argv[2] || DEFAULT_ADMIN_EMAIL;

    console.log('🔧 Making first admin...');
    console.log(`📧 Target email: ${targetEmail}`);
    console.log('');

    // Create admin client (uses service role key for admin operations)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // Step 1: Find user by email
        console.log('🔍 Searching for user...');
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

        if (listError) {
            throw new Error(`Failed to list users: ${listError.message}`);
        }

        const targetUser = users.find(u => u.email === targetEmail);

        if (!targetUser) {
            console.error(`❌ User not found: ${targetEmail}`);
            console.error('\nMake sure the user has signed up first.');
            console.error('Available users:');
            users.forEach(u => console.error(`  - ${u.email} (${u.id})`));
            process.exit(1);
        }

        console.log(`✓ Found user: ${targetUser.email}`);
        console.log(`  User ID: ${targetUser.id}`);
        console.log(`  Created: ${targetUser.created_at}`);
        console.log('');

        // Step 2: Check if already admin
        console.log('🔍 Checking admin status...');
        const { data: existingAdmin, error: checkError } = await supabase
            .from('admins')
            .select('*')
            .eq('user_id', targetUser.id)
            .maybeSingle();

        if (checkError) {
            throw new Error(`Failed to check admin status: ${checkError.message}`);
        }

        if (existingAdmin) {
            console.log('✓ User is already an admin!');
            console.log(`  Granted at: ${existingAdmin.granted_at}`);
            console.log(`  Granted by: ${existingAdmin.granted_by || 'Initial setup'}`);
            process.exit(0);
        }

        // Step 3: Grant admin privileges
        console.log('⚡ Granting admin privileges...');
        const { error: insertError } = await supabase
            .from('admins')
            .insert([{
                user_id: targetUser.id,
                granted_by: null // First admin has no granter
            }]);

        if (insertError) {
            throw new Error(`Failed to grant admin: ${insertError.message}`);
        }

        console.log('');
        console.log('✅ SUCCESS!');
        console.log(`🎉 ${targetEmail} is now an admin!`);
        console.log('');
        console.log('The user can now:');
        console.log('  - View all users and their collections');
        console.log('  - See system statistics');
        console.log('  - Grant/revoke admin privileges to other users');
        console.log('  - Access admin panel in the UI');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('❌ Error:', error.message);
        console.error('');
        if (error.message.includes('relation "admins" does not exist')) {
            console.error('It looks like the admin table has not been created yet.');
            console.error('Please run the SQL schema from supabase-schema.sql in your Supabase SQL Editor:');
            console.error('');
            console.error('1. Go to your Supabase project');
            console.error('2. Open SQL Editor');
            console.error('3. Run the contents of supabase-schema.sql');
            console.error('');
        }
        process.exit(1);
    }
}

makeFirstAdmin();
