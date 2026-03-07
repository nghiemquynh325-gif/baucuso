-- Migration: Add separate columns for permanent and temporary addresses
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS permanent_address TEXT;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS temporary_address TEXT;

COMMENT ON COLUMN public.voters.permanent_address IS 'Địa chỉ thường trú';
COMMENT ON COLUMN public.voters.temporary_address IS 'Địa chỉ tạm trú / Nơi ở hiện tại';

-- Optional: Initialize data from the general address column if empty
UPDATE public.voters 
SET permanent_address = address 
WHERE permanent_address IS NULL AND address IS NOT NULL;
