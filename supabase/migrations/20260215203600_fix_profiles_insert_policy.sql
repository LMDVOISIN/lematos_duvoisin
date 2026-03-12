-- =====================================================
-- FIX: Add Missing INSERT Policy and Trigger for Profiles
-- Le Matos du Voisin - Profile Creation Fix
-- =====================================================
-- This migration fixes the RLS policy error during signup
-- by adding the missing INSERT policy and auto-profile creation trigger
-- =====================================================

-- =====================================================
-- 1. ADD INSERT POLICY FOR PROFILES
-- =====================================================

-- Policy: Allow authenticated users to insert their own profile
-- This is needed during signup when the trigger creates the profile
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.profiles;
CREATE POLICY "user_profiles_insert_own"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- =====================================================
-- 2. CREATE TRIGGER FUNCTION FOR AUTO-PROFILE CREATION
-- =====================================================

-- Function to automatically create profile when user signs up
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
        avatar_url,
        is_admin
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'pseudo', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
        COALESCE((NEW.raw_user_meta_data->>'is_admin')::BOOLEAN, false)
    );
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        -- Profile already exists, skip
        RAISE NOTICE 'Profile already exists for user %', NEW.id;
        RETURN NEW;
    WHEN OTHERS THEN
        -- Log error but don't fail auth
        RAISE NOTICE 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- =====================================================
-- 3. CREATE TRIGGER ON AUTH.USERS
-- =====================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger that fires after user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify policies exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'profiles' 
        AND policyname = 'user_profiles_insert_own'
    ) THEN
        RAISE NOTICE '✓ INSERT policy created successfully';
    ELSE
        RAISE WARNING '✗ INSERT policy not found';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
    ) THEN
        RAISE NOTICE '✓ Trigger created successfully';
    ELSE
        RAISE WARNING '✗ Trigger not found';
    END IF;
END $$;
