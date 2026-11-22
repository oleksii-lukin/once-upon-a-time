-- Tighten user_profiles RLS: users may only create and edit their OWN profile.
--
-- Previously "Authenticated users can create/update profiles" used
-- WITH CHECK/USING (true) — any request (even anonymous) could overwrite any
-- user's profile, including flipping is_admin. Profile rows are still
-- auto-created for players by the SECURITY DEFINER trigger in
-- 20251205200002_sync_profiles.sql, which bypasses RLS, so tightening the
-- INSERT policy does not affect profile creation.

DROP POLICY IF EXISTS "Authenticated users can create profiles" ON "public"."user_profiles";
DROP POLICY IF EXISTS "Authenticated users can update profiles" ON "public"."user_profiles";

-- Same names as the original (pre-20251205200001) policies, restored with
-- an explicit TO authenticated so anon never matches.
CREATE POLICY "Users can create their own profile" ON "public"."user_profiles"
    FOR INSERT TO authenticated
    WITH CHECK (("auth"."jwt"() ->> 'sub'::"text") = "user_id");

CREATE POLICY "Users can update their own profile" ON "public"."user_profiles"
    FOR UPDATE TO authenticated
    USING (("auth"."jwt"() ->> 'sub'::"text") = "user_id")
    WITH CHECK (("auth"."jwt"() ->> 'sub'::"text") = "user_id");

-- Column-level guard: is_admin gates app_settings RLS and game admin
-- features, so row ownership alone is not enough — a user editing their own
-- profile must not be able to grant themselves admin. Direct SQL sessions
-- (Studio, psql) run without a JWT claim and stay allowed; every API role
-- (anon/authenticated/service_role) is blocked from changing the flag.
CREATE OR REPLACE FUNCTION public.protect_is_admin_column()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
AS $$
BEGIN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
       AND auth.role() IS DISTINCT FROM 'postgres' THEN
        RAISE EXCEPTION 'is_admin can only be changed via direct database access (Studio/SQL)';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_is_admin ON "public"."user_profiles";
CREATE TRIGGER protect_is_admin
    BEFORE UPDATE ON "public"."user_profiles"
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_is_admin_column();
