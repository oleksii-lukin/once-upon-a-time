-- Close debug_auth_logs to the public API.
--
-- The table logged auth role/uid/full JWT claims and was readable AND
-- writable by anyone (SELECT true, INSERT WITH CHECK true) — an
-- information leak plus a junk-writing vector. No application code reads
-- or writes it; the log function is only ever invoked manually for
-- debugging, and direct Studio/psql access is unaffected.

DROP POLICY IF EXISTS "Anyone can view debug logs" ON "public"."debug_auth_logs";
DROP POLICY IF EXISTS "Anyone can insert debug logs" ON "public"."debug_auth_logs";

REVOKE EXECUTE ON FUNCTION public.log_current_auth_state() FROM PUBLIC, anon, authenticated;
