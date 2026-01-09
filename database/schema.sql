-- Schema: full LIMS DB
-- Generated (and validated) for PostgreSQL initialization
-- Adds pgcrypto extension (required for gen_random_uuid)
-- Safe-wrapped in a single transaction (BEGIN ... COMMIT)

BEGIN;

-- Required for gen_random_uuid() calls
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure public schema exists and is the search path
CREATE SCHEMA IF NOT EXISTS public;
SET search_path = public;

-- -------------------------
-- Table: alembic_version
-- -------------------------
CREATE TABLE IF NOT EXISTS public.alembic_version
(
    version_num character varying(32) COLLATE pg_catalog."default" NOT NULL,
    CONSTRAINT alembic_version_pkey PRIMARY KEY (version_num)
);

CREATE TABLE IF NOT EXISTS public.customers
(
    customer_id serial NOT NULL,
    customer_details text COLLATE pg_catalog."default" NOT NULL,
    contact_person character varying(255) COLLATE pg_catalog."default",
    phone character varying(50) COLLATE pg_catalog."default",
    email character varying(320) COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    is_active boolean DEFAULT true,
    ship_to_address text COLLATE pg_catalog."default",
    bill_to_address text COLLATE pg_catalog."default",
    CONSTRAINT customers_pkey PRIMARY KEY (customer_id)
);

CREATE TABLE IF NOT EXISTS public.delayed_email_tasks
(
    id serial NOT NULL,
    inward_id integer,
    recipient_email character varying(320) COLLATE pg_catalog."default",
    email_type character varying(50) COLLATE pg_catalog."default" DEFAULT 'first_inspection_report'::character varying,
    scheduled_at timestamp with time zone NOT NULL,
    is_sent boolean DEFAULT false,
    is_cancelled boolean DEFAULT false,
    reminder_sent boolean DEFAULT false,
    created_by integer,
    created_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone,
    CONSTRAINT delayed_email_tasks_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.invitations
(
    id bigserial NOT NULL,
    email text COLLATE pg_catalog."default" NOT NULL,
    token text COLLATE pg_catalog."default" NOT NULL DEFAULT gen_random_uuid(),
    user_role text COLLATE pg_catalog."default" NOT NULL DEFAULT 'customer'::text,
    invited_name text COLLATE pg_catalog."default",
    expires_at timestamp with time zone NOT NULL DEFAULT (now() + '48:00:00'::interval),
    used_at timestamp with time zone,
    created_by integer,
    updated_at timestamp with time zone,
    customer_id integer,
    temp_password_hash text COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT invitations_pkey PRIMARY KEY (id),
    CONSTRAINT invitations_token_key UNIQUE (token)
);

CREATE TABLE IF NOT EXISTS public.inward
(
    inward_id serial NOT NULL,
    customer_id integer,
    srf_no character varying(100) COLLATE pg_catalog."default" NOT NULL,
    material_inward_date date NOT NULL,
    customer_dc_date character varying(255) COLLATE pg_catalog."default",
    customer_details character varying(255) COLLATE pg_catalog."default",
    received_by text COLLATE pg_catalog."default",
    created_by integer,
    updated_by integer,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone,
    status character varying(50) COLLATE pg_catalog."default" DEFAULT 'created'::character varying,
    draft_data jsonb,
    is_draft boolean DEFAULT false,
    draft_updated_at timestamp with time zone,
    customer_dc_no character varying(255) COLLATE pg_catalog."default",
    CONSTRAINT inward_pkey PRIMARY KEY (inward_id),
    CONSTRAINT inward_srf_no_key UNIQUE (srf_no)
);

CREATE TABLE IF NOT EXISTS public.inward_equipments
(
    inward_eqp_id serial NOT NULL,
    inward_id integer,
    nepl_id character varying(100) COLLATE pg_catalog."default" NOT NULL,
    material_description character varying(500) COLLATE pg_catalog."default",
    make character varying(255) COLLATE pg_catalog."default",
    model character varying(255) COLLATE pg_catalog."default",
    range character varying(255) COLLATE pg_catalog."default",
    serial_no character varying(255) COLLATE pg_catalog."default",
    quantity integer NOT NULL DEFAULT 1,
    visual_inspection_notes text COLLATE pg_catalog."default",
    photos jsonb,
    calibration_by character varying(50) COLLATE pg_catalog."default",
    supplier character varying(255) COLLATE pg_catalog."default",
    out_dc character varying(255) COLLATE pg_catalog."default",
    in_dc character varying(255) COLLATE pg_catalog."default",
    nextage_contract_reference character varying(255) COLLATE pg_catalog."default",
    qr_code text COLLATE pg_catalog."default",
    barcode text COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    engineer_remarks character varying(255) COLLATE pg_catalog."default",
    customer_remarks character varying(255) COLLATE pg_catalog."default",
    accessories_included text COLLATE pg_catalog."default",
    status character varying(50) COLLATE pg_catalog."default" DEFAULT 'pending'::character varying,
    CONSTRAINT inward_equipments_pkey PRIMARY KEY (inward_eqp_id),
    CONSTRAINT inward_equipments_nepl_id_key UNIQUE (nepl_id)
);

CREATE TABLE IF NOT EXISTS public.notifications
(
    id serial NOT NULL,
    recipient_user_id integer,
    to_email character varying(255) COLLATE pg_catalog."default",
    inward_id integer,
    subject text COLLATE pg_catalog."default",
    body_text text COLLATE pg_catalog."default",
    email_sent_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by character varying(255) COLLATE pg_catalog."default",
    status character varying(30) COLLATE pg_catalog."default" DEFAULT 'pending'::character varying,
    error text COLLATE pg_catalog."default",
    CONSTRAINT notifications_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens
(
    id serial NOT NULL,
    user_id integer NOT NULL,
    token character varying(255) COLLATE pg_catalog."default" NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    is_used boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT password_reset_tokens_token_key UNIQUE (token)
);

CREATE TABLE IF NOT EXISTS public.refresh_tokens
(
    id serial NOT NULL,
    user_id integer NOT NULL,
    token character varying(500) COLLATE pg_catalog."default" NOT NULL,
    expiry_time timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    is_revoked integer DEFAULT 0,
    CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT refresh_tokens_token_key UNIQUE (token)
);

CREATE TABLE IF NOT EXISTS public.srf_equipments
(
    srf_eqp_id serial NOT NULL,
    srf_id integer,
    inward_eqp_id integer,
    unit text COLLATE pg_catalog."default",
    no_of_calibration_points text COLLATE pg_catalog."default",
    mode_of_calibration text COLLATE pg_catalog."default",
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    status character varying(50) COLLATE pg_catalog."default" DEFAULT 'pending'::character varying,
    CONSTRAINT srf_equipments_pkey PRIMARY KEY (srf_eqp_id),
    CONSTRAINT srf_equipments_inward_eqp_id_key UNIQUE (inward_eqp_id)
);

CREATE TABLE IF NOT EXISTS public.srfs
(
    srf_id serial NOT NULL,
    inward_id integer,
    srf_no text COLLATE pg_catalog."default" NOT NULL,
    nepl_srf_no character varying(100) COLLATE pg_catalog."default",
    date date NOT NULL,
    telephone character varying(50) COLLATE pg_catalog."default",
    contact_person character varying(255) COLLATE pg_catalog."default",
    email character varying(320) COLLATE pg_catalog."default",
    certificate_issue_name character varying(255) COLLATE pg_catalog."default",
    calibration_frequency character varying(100) COLLATE pg_catalog."default",
    statement_of_conformity boolean DEFAULT false,
    ref_iso_is_doc boolean DEFAULT false,
    ref_manufacturer_manual boolean DEFAULT false,
    ref_customer_requirement boolean DEFAULT false,
    turnaround_time integer DEFAULT 7,
    remark_special_instructions text COLLATE pg_catalog."default",
    customer_approval character varying(50) COLLATE pg_catalog."default",
    status character varying(50) COLLATE pg_catalog."default" DEFAULT 'created'::character varying,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone,
    remarks text COLLATE pg_catalog."default",
    is_draft boolean DEFAULT false,
    draft_data jsonb,
    draft_updated_at timestamp with time zone,
    certificate_issue_adress text COLLATE pg_catalog."default",
    CONSTRAINT srfs_pkey PRIMARY KEY (srf_id),
    CONSTRAINT srfs_inward_id_key UNIQUE (inward_id),
    CONSTRAINT srfs_nepl_srf_no_key UNIQUE (nepl_srf_no)
);

CREATE TABLE IF NOT EXISTS public.users
(
    user_id serial NOT NULL,
    customer_id integer,
    username character varying(150) COLLATE pg_catalog."default" NOT NULL,
    email character varying(320) COLLATE pg_catalog."default" NOT NULL,
    password_hash text COLLATE pg_catalog."default" NOT NULL,
    full_name character varying(255) COLLATE pg_catalog."default",
    role character varying(50) COLLATE pg_catalog."default" NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    CONSTRAINT users_pkey PRIMARY KEY (user_id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_username_key UNIQUE (username)
);

CREATE TABLE IF NOT EXISTS public.htw_master_standard
(
    id serial NOT NULL,
    nomenclature character varying(255) COLLATE pg_catalog."default" NOT NULL,
    range_min numeric,
    range_max numeric,
    range_unit character varying(50) COLLATE pg_catalog."default",
    manufacturer character varying(255) COLLATE pg_catalog."default",
    model_serial_no character varying(255) COLLATE pg_catalog."default",
    traceable_to_lab character varying(255) COLLATE pg_catalog."default",
    uncertainty numeric,
    uncertainty_unit character varying(50) COLLATE pg_catalog."default",
    certificate_no character varying(255) COLLATE pg_catalog."default",
    calibration_valid_upto date,
    accuracy_of_master character varying(255) COLLATE pg_catalog."default",
    resolution numeric,
    resolution_unit character varying(50) COLLATE pg_catalog."default",
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    CONSTRAINT htw_master_standard_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.htw_nomenclature_range
(
    id serial NOT NULL,
    nomenclature character varying(255) COLLATE pg_catalog."default" NOT NULL,
    range_min numeric NOT NULL,
    range_max numeric NOT NULL,
    is_active boolean DEFAULT true,
    valid_upto date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    CONSTRAINT htw_nomenclature_range_pkey PRIMARY KEY (id),
    CONSTRAINT htw_nomenclature_range_range_check CHECK (range_min < range_max)
);

ALTER TABLE IF EXISTS public.delayed_email_tasks
    ADD CONSTRAINT delayed_email_tasks_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.delayed_email_tasks
    ADD CONSTRAINT delayed_email_tasks_inward_id_fkey FOREIGN KEY (inward_id)
    REFERENCES public.inward (inward_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.invitations
    ADD CONSTRAINT invitations_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.invitations
    ADD CONSTRAINT invitations_customer_id_fkey FOREIGN KEY (customer_id)
    REFERENCES public.customers (customer_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.inward
    ADD CONSTRAINT inward_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.inward
    ADD CONSTRAINT inward_customer_id_fkey FOREIGN KEY (customer_id)
    REFERENCES public.customers (customer_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_inward_customer_id
    ON public.inward(customer_id);


ALTER TABLE IF EXISTS public.inward
    ADD CONSTRAINT inward_updated_by_fkey FOREIGN KEY (updated_by)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.inward_equipments
    ADD CONSTRAINT inward_equipments_inward_id_fkey FOREIGN KEY (inward_id)
    REFERENCES public.inward (inward_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.notifications
    ADD CONSTRAINT notifications_inward_id_fkey FOREIGN KEY (inward_id)
    REFERENCES public.inward (inward_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.notifications
    ADD CONSTRAINT notifications_recipient_user_id_fkey FOREIGN KEY (recipient_user_id)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users (user_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;


ALTER TABLE IF EXISTS public.srf_equipments
    ADD CONSTRAINT srf_equipments_inward_eqp_id_fkey FOREIGN KEY (inward_eqp_id)
    REFERENCES public.inward_equipments (inward_eqp_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS srf_equipments_inward_eqp_id_key
    ON public.srf_equipments(inward_eqp_id);


ALTER TABLE IF EXISTS public.srf_equipments
    ADD CONSTRAINT srf_equipments_srf_id_fkey FOREIGN KEY (srf_id)
    REFERENCES public.srfs (srf_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;


ALTER TABLE IF EXISTS public.srfs
    ADD CONSTRAINT srfs_inward_id_fkey FOREIGN KEY (inward_id)
    REFERENCES public.inward (inward_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS srfs_inward_id_key
    ON public.srfs(inward_id);


ALTER TABLE IF EXISTS public.users
    ADD CONSTRAINT users_customer_id_fkey FOREIGN KEY (customer_id)
    REFERENCES public.customers (customer_id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

COMMIT;
