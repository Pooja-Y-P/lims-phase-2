-- Add missing status column to srf_equipments table
-- Run this in your PostgreSQL database to fix the "column srf_equipments.status does not exist" error

ALTER TABLE srf_equipments 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'srf_equipments' AND column_name = 'status';

