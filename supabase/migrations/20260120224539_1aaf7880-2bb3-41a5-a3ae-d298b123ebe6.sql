-- =============================================
-- SECURITY HARDENING: Fix Critical RLS Policies
-- =============================================

-- 1. Fix transactions table - block direct SELECT
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
CREATE POLICY "No direct SELECT - use edge functions" 
  ON transactions FOR SELECT 
  USING (false);

-- 2. Fix support_tickets table - block direct SELECT
DROP POLICY IF EXISTS "Users can view their own tickets" ON support_tickets;
CREATE POLICY "No direct SELECT - use edge functions" 
  ON support_tickets FOR SELECT 
  USING (false);

-- 3. Fix support_messages table - block direct SELECT
DROP POLICY IF EXISTS "Anyone can view ticket messages" ON support_messages;
CREATE POLICY "No direct SELECT - use edge functions" 
  ON support_messages FOR SELECT 
  USING (false);

-- 4. Fix feedback table - block direct SELECT
DROP POLICY IF EXISTS "Users can view their own feedback" ON feedback;
CREATE POLICY "No direct SELECT - use edge functions" 
  ON feedback FOR SELECT 
  USING (false);