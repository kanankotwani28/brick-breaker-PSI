--
-- PostgreSQL database dump
--

\restrict dprEYE44pXsFOTlxv3ubYWs9adcYfIc7HGrLoeyKxKcbpEvXornC9oseKnAV3Nc

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: calculate_impression_duration(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_impression_duration() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        -- Calculate duration and round to nearest millisecond
        NEW.duration_ms = ROUND(EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) * 1000);
        
        -- Ensure duration is not negative (handle clock skew)
        IF NEW.duration_ms < 0 THEN
            NEW.duration_ms = 0;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.calculate_impression_duration() OWNER TO postgres;

--
-- Name: calculate_session_duration(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_session_duration() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
        NEW.session_duration_ms = EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at)) * 1000;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.calculate_session_duration() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: asset_impressions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_impressions (
    id bigint NOT NULL,
    session_id uuid,
    asset_id uuid,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    duration_ms integer,
    board_x integer,
    board_y integer,
    impression_context text DEFAULT 'game_board'::text,
    meta jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT valid_board_position CHECK (((board_x >= 0) AND (board_y >= 0))),
    CONSTRAINT valid_impression_duration CHECK ((((ended_at IS NULL) AND (duration_ms IS NULL)) OR ((ended_at IS NOT NULL) AND (duration_ms >= 0) AND ((duration_ms)::numeric <= ((EXTRACT(epoch FROM (ended_at - started_at)) * (1000)::numeric) + (100)::numeric)))))
);


ALTER TABLE public.asset_impressions OWNER TO postgres;

--
-- Name: asset_impressions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asset_impressions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asset_impressions_id_seq OWNER TO postgres;

--
-- Name: asset_impressions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asset_impressions_id_seq OWNED BY public.asset_impressions.id;


--
-- Name: asset_interactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_interactions (
    id bigint NOT NULL,
    session_id uuid,
    asset_id uuid,
    interaction_type text NOT NULL,
    occurred_at timestamp with time zone DEFAULT now(),
    board_x integer,
    board_y integer,
    details jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT asset_interactions_interaction_type_check CHECK ((interaction_type = ANY (ARRAY['tap'::text, 'swap'::text, 'long_press'::text, 'special_activation'::text]))),
    CONSTRAINT valid_interaction_position CHECK (((board_x >= 0) AND (board_y >= 0)))
);


ALTER TABLE public.asset_interactions OWNER TO postgres;

--
-- Name: asset_interactions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asset_interactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asset_interactions_id_seq OWNER TO postgres;

--
-- Name: asset_interactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asset_interactions_id_seq OWNED BY public.asset_interactions.id;


--
-- Name: asset_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid,
    filename text NOT NULL,
    url text NOT NULL,
    version integer NOT NULL,
    size_bytes bigint,
    created_at timestamp with time zone DEFAULT now(),
    meta jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.asset_versions OWNER TO postgres;

--
-- Name: asset_visibility_totals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asset_visibility_totals (
    asset_id uuid NOT NULL,
    total_visible_ms bigint DEFAULT 0 NOT NULL,
    last_heartbeat_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.asset_visibility_totals OWNER TO postgres;

--
-- Name: assets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    filename text NOT NULL,
    url text NOT NULL,
    mime_type text,
    width integer,
    height integer,
    size_bytes bigint,
    uploaded_by uuid,
    uploaded_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    version integer DEFAULT 1,
    tags text[] DEFAULT '{}'::text[],
    category text DEFAULT 'candy'::text,
    meta jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT positive_dimensions CHECK (((width > 0) AND (height > 0))),
    CONSTRAINT positive_size CHECK ((size_bytes > 0)),
    CONSTRAINT valid_mime_type CHECK ((mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text, 'image/gif'::text])))
);


ALTER TABLE public.assets OWNER TO postgres;

--
-- Name: game_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.game_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    started_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone,
    device_info jsonb DEFAULT '{}'::jsonb,
    game_version text,
    session_duration_ms integer,
    CONSTRAINT valid_duration CHECK ((((ended_at IS NULL) AND (session_duration_ms IS NULL)) OR ((ended_at IS NOT NULL) AND (session_duration_ms > 0))))
);


ALTER TABLE public.game_sessions OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text,
    password_hash text,
    role text DEFAULT 'player'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    last_login timestamp with time zone,
    meta jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'player'::text])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: asset_impressions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_impressions ALTER COLUMN id SET DEFAULT nextval('public.asset_impressions_id_seq'::regclass);


--
-- Name: asset_interactions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_interactions ALTER COLUMN id SET DEFAULT nextval('public.asset_interactions_id_seq'::regclass);


--
-- Data for Name: asset_impressions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_impressions (id, session_id, asset_id, started_at, ended_at, duration_ms, board_x, board_y, impression_context, meta) FROM stdin;
\.


--
-- Data for Name: asset_interactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_interactions (id, session_id, asset_id, interaction_type, occurred_at, board_x, board_y, details) FROM stdin;
\.


--
-- Data for Name: asset_versions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_versions (id, asset_id, filename, url, version, size_bytes, created_at, meta) FROM stdin;
\.


--
-- Data for Name: asset_visibility_totals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.asset_visibility_totals (asset_id, total_visible_ms, last_heartbeat_at, updated_at) FROM stdin;
\.


--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.assets (id, name, filename, url, mime_type, width, height, size_bytes, uploaded_by, uploaded_at, updated_at, is_active, version, tags, category, meta) FROM stdin;
\.


--
-- Data for Name: game_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.game_sessions (id, user_id, started_at, ended_at, device_info, game_version, session_duration_ms) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, password_hash, role, created_at, updated_at, is_active, last_login, meta) FROM stdin;
936575c4-a80b-488e-b8e0-939f5aed3dd2	admin@gameanalytics.com	$2a$12$yIHvn8kILiH4enqrRhScSeHKhTYQqKe.yV6yzXzwiuXeSbRdA/3GK	admin	2026-08-26 14:41:45.37502+05:30	2026-08-27 19:35:53.442828+05:30	t	2026-08-27 19:35:53.442828+05:30	{}
\.


--
-- Name: asset_impressions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.asset_impressions_id_seq', 1, false);


--
-- Name: asset_interactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.asset_interactions_id_seq', 1, false);


--
-- Name: asset_impressions asset_impressions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_impressions
    ADD CONSTRAINT asset_impressions_pkey PRIMARY KEY (id);


--
-- Name: asset_interactions asset_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_interactions
    ADD CONSTRAINT asset_interactions_pkey PRIMARY KEY (id);


--
-- Name: asset_versions asset_versions_asset_id_version_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_versions
    ADD CONSTRAINT asset_versions_asset_id_version_key UNIQUE (asset_id, version);


--
-- Name: asset_versions asset_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_versions
    ADD CONSTRAINT asset_versions_pkey PRIMARY KEY (id);


--
-- Name: asset_visibility_totals asset_visibility_totals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_visibility_totals
    ADD CONSTRAINT asset_visibility_totals_pkey PRIMARY KEY (asset_id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: assets assets_url_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_url_key UNIQUE (url);


--
-- Name: game_sessions game_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.game_sessions
    ADD CONSTRAINT game_sessions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_asset_visibility_totals_updated_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_asset_visibility_totals_updated_at ON public.asset_visibility_totals USING btree (updated_at DESC);


--
-- Name: idx_assets_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_active ON public.assets USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_assets_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_category ON public.assets USING btree (category);


--
-- Name: idx_assets_tags; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_tags ON public.assets USING gin (tags);


--
-- Name: idx_assets_uploaded_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assets_uploaded_at ON public.assets USING btree (uploaded_at);


--
-- Name: idx_game_sessions_started; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_game_sessions_started ON public.game_sessions USING btree (started_at);


--
-- Name: idx_game_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_game_sessions_user ON public.game_sessions USING btree (user_id);


--
-- Name: idx_impressions_asset; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_impressions_asset ON public.asset_impressions USING btree (asset_id);


--
-- Name: idx_impressions_asset_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_impressions_asset_time ON public.asset_impressions USING btree (asset_id, started_at);


--
-- Name: idx_impressions_duration; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_impressions_duration ON public.asset_impressions USING btree (duration_ms) WHERE (duration_ms IS NOT NULL);


--
-- Name: idx_impressions_ended; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_impressions_ended ON public.asset_impressions USING btree (ended_at);


--
-- Name: idx_impressions_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_impressions_session ON public.asset_impressions USING btree (session_id);


--
-- Name: idx_impressions_started; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_impressions_started ON public.asset_impressions USING btree (started_at);


--
-- Name: idx_interactions_asset; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interactions_asset ON public.asset_interactions USING btree (asset_id);


--
-- Name: idx_interactions_asset_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interactions_asset_time ON public.asset_interactions USING btree (asset_id, occurred_at);


--
-- Name: idx_interactions_occurred; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interactions_occurred ON public.asset_interactions USING btree (occurred_at);


--
-- Name: idx_interactions_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interactions_session ON public.asset_interactions USING btree (session_id);


--
-- Name: idx_interactions_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interactions_type ON public.asset_interactions USING btree (interaction_type);


--
-- Name: asset_impressions calculate_impression_duration_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER calculate_impression_duration_trigger BEFORE INSERT OR UPDATE ON public.asset_impressions FOR EACH ROW EXECUTE FUNCTION public.calculate_impression_duration();


--
-- Name: game_sessions calculate_session_duration_trigger; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER calculate_session_duration_trigger BEFORE INSERT OR UPDATE ON public.game_sessions FOR EACH ROW EXECUTE FUNCTION public.calculate_session_duration();


--
-- Name: asset_visibility_totals update_asset_visibility_totals_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_asset_visibility_totals_updated_at BEFORE UPDATE ON public.asset_visibility_totals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: assets update_assets_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: asset_impressions asset_impressions_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_impressions
    ADD CONSTRAINT asset_impressions_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: asset_impressions asset_impressions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_impressions
    ADD CONSTRAINT asset_impressions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.game_sessions(id) ON DELETE SET NULL;


--
-- Name: asset_interactions asset_interactions_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_interactions
    ADD CONSTRAINT asset_interactions_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE SET NULL;


--
-- Name: asset_interactions asset_interactions_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_interactions
    ADD CONSTRAINT asset_interactions_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.game_sessions(id) ON DELETE SET NULL;


--
-- Name: asset_versions asset_versions_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_versions
    ADD CONSTRAINT asset_versions_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: asset_visibility_totals asset_visibility_totals_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asset_visibility_totals
    ADD CONSTRAINT asset_visibility_totals_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: assets assets_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: game_sessions game_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.game_sessions
    ADD CONSTRAINT game_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict dprEYE44pXsFOTlxv3ubYWs9adcYfIc7HGrLoeyKxKcbpEvXornC9oseKnAV3Nc

