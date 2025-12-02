


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."log_current_auth_state"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into debug_auth_logs (auth_role, auth_uid, jwt_claims)
  values (
    auth.role(),
    (auth.jwt() ->> 'sub'),
    auth.jwt()
  );
end;
$$;


ALTER FUNCTION "public"."log_current_auth_state"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_deck_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.created_by is null then
    new.created_by = (auth.jwt() ->> 'sub');
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_deck_created_by"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deck_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "usage_examples" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."debug_auth_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "auth_role" "text",
    "auth_uid" "text",
    "jwt_claims" "jsonb"
);


ALTER TABLE "public"."debug_auth_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."decks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT false,
    "created_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."decks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lobbies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'waiting'::"text" NOT NULL,
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "lobbies_status_check" CHECK (("status" = ANY (ARRAY['waiting'::"text", 'playing'::"text", 'finished'::"text"])))
);


ALTER TABLE "public"."lobbies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lobby_id" "uuid" NOT NULL,
    "user_id" "text",
    "role" "text" DEFAULT 'player'::"text" NOT NULL,
    "status" "text" DEFAULT 'not_ready'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "guest_id" "uuid",
    CONSTRAINT "players_role_check" CHECK (("role" = ANY (ARRAY['host'::"text", 'player'::"text", 'spectator'::"text"]))),
    CONSTRAINT "players_status_check" CHECK (("status" = ANY (ARRAY['ready'::"text", 'not_ready'::"text"]))),
    CONSTRAINT "players_user_or_guest_check" CHECK ((("user_id" IS NOT NULL) OR ("guest_id" IS NOT NULL)))
);


ALTER TABLE "public"."players" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."debug_auth_logs"
    ADD CONSTRAINT "debug_auth_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."decks"
    ADD CONSTRAINT "decks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lobbies"
    ADD CONSTRAINT "lobbies_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."lobbies"
    ADD CONSTRAINT "lobbies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_lobby_id_user_id_key" UNIQUE ("lobby_id", "user_id");



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "set_deck_created_by_trigger" BEFORE INSERT ON "public"."decks" FOR EACH ROW EXECUTE FUNCTION "public"."set_deck_created_by"();



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "public"."decks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."players"
    ADD CONSTRAINT "players_lobby_id_fkey" FOREIGN KEY ("lobby_id") REFERENCES "public"."lobbies"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can create lobbies" ON "public"."lobbies" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert debug logs" ON "public"."debug_auth_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can join lobbies" ON "public"."players" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can update lobbies" ON "public"."lobbies" FOR UPDATE USING (true);



CREATE POLICY "Anyone can update player status" ON "public"."players" FOR UPDATE USING (true);



CREATE POLICY "Anyone can view debug logs" ON "public"."debug_auth_logs" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can create decks" ON "public"."decks" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Creators can update cards" ON "public"."cards" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."decks"
  WHERE (("decks"."id" = "cards"."deck_id") AND ("decks"."created_by" = ("auth"."jwt"() ->> 'sub'::"text"))))));



CREATE POLICY "Creators can update their decks" ON "public"."decks" FOR UPDATE USING ((("auth"."jwt"() ->> 'sub'::"text") = "created_by"));



CREATE POLICY "Lobbies are viewable by everyone" ON "public"."lobbies" FOR SELECT USING (true);



CREATE POLICY "Lobby creators can update their lobbies" ON "public"."lobbies" FOR UPDATE USING ((("auth"."jwt"() ->> 'sub'::"text") = "created_by"));



CREATE POLICY "Players are viewable by everyone" ON "public"."players" FOR SELECT USING (true);



CREATE POLICY "Users can create lobbies" ON "public"."lobbies" FOR INSERT WITH CHECK ((("auth"."jwt"() ->> 'sub'::"text") = "created_by"));



CREATE POLICY "Users can join lobbies" ON "public"."players" FOR INSERT WITH CHECK (((("auth"."jwt"() ->> 'sub'::"text") = "user_id") OR ((("auth"."jwt"() ->> 'sub'::"text") IS NULL) AND ("guest_id" IS NOT NULL))));



ALTER TABLE "public"."cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."debug_auth_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."decks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lobbies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."players" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."lobbies";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."players";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."log_current_auth_state"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_current_auth_state"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_current_auth_state"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_deck_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_deck_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_deck_created_by"() TO "service_role";


















GRANT ALL ON TABLE "public"."cards" TO "anon";
GRANT ALL ON TABLE "public"."cards" TO "authenticated";
GRANT ALL ON TABLE "public"."cards" TO "service_role";



GRANT ALL ON TABLE "public"."debug_auth_logs" TO "anon";
GRANT ALL ON TABLE "public"."debug_auth_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."debug_auth_logs" TO "service_role";



GRANT ALL ON TABLE "public"."decks" TO "anon";
GRANT ALL ON TABLE "public"."decks" TO "authenticated";
GRANT ALL ON TABLE "public"."decks" TO "service_role";



GRANT ALL ON TABLE "public"."lobbies" TO "anon";
GRANT ALL ON TABLE "public"."lobbies" TO "authenticated";
GRANT ALL ON TABLE "public"."lobbies" TO "service_role";



GRANT ALL ON TABLE "public"."players" TO "anon";
GRANT ALL ON TABLE "public"."players" TO "authenticated";
GRANT ALL ON TABLE "public"."players" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































