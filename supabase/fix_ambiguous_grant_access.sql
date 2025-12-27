-- Drop the old 3-argument function to resolve ambiguity with the new 5-argument version
DROP FUNCTION IF EXISTS public.grant_access_by_email(uuid, text, text);
