#!/usr/bin/env node

/**
 * Admin Status Diagnostic Tool
 *
 * This script checks if your user is properly configured as an admin
 * in the database and helps diagnose admin access issues.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

// Load .env file manually
try {
    const envContent = await fs.readFile('.env', 'utf-8');
    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=:#]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
} catch (error) {
    console.log('⚠️  Could not load .env file, using system environment variables');
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env');
    console.error('Please ensure your .env file has these variables set.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function diagnoseAdminStatus() {
    console.log('\n🔍 MTG Collection Admin Diagnostic Tool\n');
    console.log('='.repeat(60));

    try {
        // 1. Check auth.users table
        console.log('\n1️⃣ Checking auth.users table...');
        const { data: users, error: usersError } = await supabase
            .from('auth.users')
            .select('id, email, created_at')
            .limit(10);

        if (usersError) {
            console.error('❌ Error querying auth.users:', usersError.message);
            console.log('⚠️  Trying alternative query...');

            // Alternative: Try to get users through RPC or admin endpoint
            const { data: allUsers, error: altError } = await supabase.auth.admin.listUsers();
            if (altError) {
                console.error('❌ Could not retrieve users:', altError.message);
            } else {
                console.log(`✅ Found ${allUsers.users.length} users in auth system`);
                console.log('\nUsers:');
                allUsers.users.forEach((user, index) => {
                    console.log(`  ${index + 1}. ${user.email} (ID: ${user.id})`);
                });
            }
        } else {
            console.log(`✅ Found ${users.length} users`);
            users.forEach((user, index) => {
                console.log(`  ${index + 1}. ${user.email} (ID: ${user.id})`);
            });
        }

        // 2. Check admins table
        console.log('\n2️⃣ Checking admins table...');
        const { data: admins, error: adminsError } = await supabase
            .from('admins')
            .select('*');

        if (adminsError) {
            console.error('❌ Error querying admins table:', adminsError.message);
            console.log('\n⚠️  The admins table might not exist or might have RLS issues.');
            return;
        }

        if (!admins || admins.length === 0) {
            console.log('❌ No admins found in the database!');
            console.log('\n📝 To fix this, you need to add your user as an admin.');
            console.log('   Run: node scripts/make-first-admin.js <your-email>');
            return;
        }

        console.log(`✅ Found ${admins.length} admin(s):`);
        admins.forEach((admin, index) => {
            console.log(`  ${index + 1}. User ID: ${admin.user_id}`);
            if (admin.granted_at) {
                console.log(`     Granted at: ${new Date(admin.granted_at).toLocaleString()}`);
            }
            if (admin.granted_by) {
                console.log(`     Granted by: ${admin.granted_by}`);
            }
        });

        // 3. Cross-reference: Get user emails for admin IDs
        console.log('\n3️⃣ Cross-referencing admin users...');
        for (const admin of admins) {
            const { data: userData, error: userError } = await supabase.auth.admin.getUserById(admin.user_id);

            if (userError || !userData.user) {
                console.log(`  ⚠️  Admin user ${admin.user_id}: User not found in auth system`);
            } else {
                console.log(`  ✅ Admin: ${userData.user.email} (ID: ${admin.user_id})`);
            }
        }

        // 4. Check RLS policies
        console.log('\n4️⃣ Checking Row Level Security (RLS) policies...');
        const { data: policies, error: policiesError } = await supabase
            .rpc('get_policies_for_table', { table_name: 'admins' })
            .catch(() => null);

        if (policiesError || !policies) {
            console.log('⚠️  Could not check RLS policies (this is normal)');
            console.log('   RLS should allow authenticated users to SELECT from admins table');
        } else {
            console.log('✅ RLS policies found:', policies);
        }

        // 5. Summary and recommendations
        console.log('\n' + '='.repeat(60));
        console.log('\n📊 DIAGNOSTIC SUMMARY\n');

        if (admins.length === 0) {
            console.log('❌ PROBLEM: No admins in database');
            console.log('\n💡 SOLUTION:');
            console.log('   1. Run: node scripts/make-first-admin.js <your-email>');
            console.log('   2. Restart your server');
            console.log('   3. Log in with that email');
            console.log('   4. You should see the admin tab');
        } else {
            console.log('✅ Admin configuration looks good!');
            console.log('\n💡 If you still can\'t see admin access:');
            console.log('   1. Make sure you\'re logged in with one of the admin emails listed above');
            console.log('   2. Check browser console for errors (F12 > Console)');
            console.log('   3. Check server logs for authentication issues');
            console.log('   4. Clear browser cache and reload the page');
            console.log('   5. Verify your auth token is valid (check Network tab in DevTools)');
        }

        console.log('\n' + '='.repeat(60) + '\n');

    } catch (error) {
        console.error('\n❌ Fatal error during diagnostic:', error.message);
        console.error('\nStack trace:', error.stack);
        process.exit(1);
    }
}

// Run the diagnostic
diagnoseAdminStatus()
    .then(() => {
        console.log('✅ Diagnostic complete\n');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Unexpected error:', error);
        process.exit(1);
    });
