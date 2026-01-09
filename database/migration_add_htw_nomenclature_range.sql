-- Migration: Add htw_nomenclature_range table if it doesn't exist, or add missing columns
-- Run this script to fix the missing updated_at column issue

BEGIN;

-- Create table if it doesn't exist
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

-- Add updated_at column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'htw_nomenclature_range' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.htw_nomenclature_range 
        ADD COLUMN updated_at timestamp with time zone;
    END IF;
END $$;

COMMIT;

