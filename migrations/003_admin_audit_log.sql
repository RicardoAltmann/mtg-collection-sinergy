-- Migration: Add admin audit log table
-- Run this in Supabase SQL Editor to add audit logging

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
