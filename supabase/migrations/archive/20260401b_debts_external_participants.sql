-- Add participant information to debts table to support external participants
-- This allows debts involving external members to be properly tracked and displayed

ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS from_participant_id UUID;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS to_participant_id UUID;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS from_participant_name TEXT;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS to_participant_name TEXT;

-- Add indexes for the new participant columns
CREATE INDEX IF NOT EXISTS idx_debts_from_participant ON public.debts(from_participant_id);
CREATE INDEX IF NOT EXISTS idx_debts_to_participant ON public.debts(to_participant_id);

-- Update existing debts to populate participant info from user mappings
-- This is for backward compatibility with existing debt records
UPDATE public.debts
SET
  from_participant_name = COALESCE(
    (SELECT display_name FROM auth.users WHERE id = debts.from_user),
    from_user::text
  ),
  to_participant_name = COALESCE(
    (SELECT display_name FROM auth.users WHERE id = debts.to_user),
    to_user::text
  )
WHERE from_participant_name IS NULL OR to_participant_name IS NULL;