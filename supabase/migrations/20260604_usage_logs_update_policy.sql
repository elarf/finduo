-- Add UPDATE policy for usage_logs to allow users to edit their own logs
-- This was missing and causing silent RLS blocks on edit operations

CREATE POLICY "Users can update their own usage logs"
ON usage_logs
FOR UPDATE
USING (recorded_by = auth.uid())
WITH CHECK (recorded_by = auth.uid());
