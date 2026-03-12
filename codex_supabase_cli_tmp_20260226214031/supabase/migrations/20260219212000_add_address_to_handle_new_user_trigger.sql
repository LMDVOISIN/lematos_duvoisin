-- Ensure signup metadata includes postal address in auto-created profiles.
-- This updates the existing auth.users -> public.profiles trigger function.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        pseudo,
        email,
        phone,
        address,
        city,
        postal_code,
        avatar_url,
        is_admin
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'pseudo', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
        COALESCE(
            NEW.raw_user_meta_data->>'address',
            NEW.raw_user_meta_data->>'postal_address',
            NEW.raw_user_meta_data->>'adresse',
            NULL
        ),
        COALESCE(
            NEW.raw_user_meta_data->>'city',
            NEW.raw_user_meta_data->>'ville',
            NULL
        ),
        COALESCE(
            NEW.raw_user_meta_data->>'postal_code',
            NEW.raw_user_meta_data->>'code_postal',
            NULL
        ),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
        COALESCE((NEW.raw_user_meta_data->>'is_admin')::BOOLEAN, false)
    );
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'Profile already exists for user %', NEW.id;
        RETURN NEW;
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;
