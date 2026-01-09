-- Quick fix: Add missing updated_at column to htw_nomenclature_range table
-- Run this in your PostgreSQL database

-- Option 1: Add the column if it doesn't exist (safest)
ALTER TABLE public.htw_nomenclature_range 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;

-- Option 2: If the table structure is completely wrong, drop and recreate (ONLY if no important data exists)
-- DROP TABLE IF EXISTS public.htw_nomenclature_range CASCADE;
-- Then run the CREATE TABLE statement from schema.sql

