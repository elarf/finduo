-- Update global Transfer categories to use the Replace icon.
UPDATE public.categories
SET icon = 'Replace'
WHERE id IN (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000011'
);
