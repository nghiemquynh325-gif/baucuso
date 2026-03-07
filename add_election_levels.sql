-- Migration: Add election level eligibility columns to voters table
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS vote_qh BOOLEAN DEFAULT TRUE;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS vote_t BOOLEAN DEFAULT TRUE;
ALTER TABLE public.voters ADD COLUMN IF NOT EXISTS vote_p BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN public.voters.vote_qh IS 'Quyền bầu cử đại biểu Quốc hội';
COMMENT ON COLUMN public.voters.vote_t IS 'Quyền bầu cử đại biểu HĐND cấp Tỉnh/Thành phố';
COMMENT ON COLUMN public.voters.vote_p IS 'Quyền bầu cử đại biểu HĐND cấp Phường/Xã';
