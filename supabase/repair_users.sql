-- -----------------------------------------------------------------------------
-- Repair Script: Fix missing public user profiles
-- -----------------------------------------------------------------------------
-- Run this in the Supabase SQL Editor to generate missing profiles for
-- users that exist in auth.users but not in public.users.

DO $$
DECLARE
  missing_user RECORD;
  new_bookset_id uuid;
BEGIN
  FOR missing_user IN
    SELECT * FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.users)
  LOOP
    RAISE NOTICE 'Fixing user: % (%)', missing_user.id, missing_user.email;

    -- 1. Insert into users table
    INSERT INTO public.users (id, email, display_name)
    VALUES (
      missing_user.id,
      missing_user.email,
      COALESCE(missing_user.raw_user_meta_data->>'display_name', split_part(missing_user.email, '@', 1))
    );

    -- 2. Create default bookset
    INSERT INTO public.booksets (owner_id, name, business_type)
    VALUES (
      missing_user.id,
      COALESCE(missing_user.raw_user_meta_data->>'display_name', 'My') || '''s Books',
      'personal'
    )
    RETURNING id INTO new_bookset_id;

    -- 3. Update user with bookset references
    UPDATE public.users
    SET active_bookset_id = new_bookset_id,
        own_bookset_id = new_bookset_id
    WHERE id = missing_user.id;
    
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- Verify Trigger Setup (Re-apply just in case)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_bookset_id uuid;
BEGIN
  INSERT INTO public.users (id, email, display_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'display_name');

  INSERT INTO public.booksets (owner_id, name, business_type)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', 'My') || '''s Books', 'personal')
  RETURNING id INTO new_bookset_id;

  UPDATE public.users
  SET active_bookset_id = new_bookset_id,
      own_bookset_id = new_bookset_id
  WHERE id = new.id;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
