
-- Fix overly permissive INSERT policies - scope them properly

-- Drop permissive policies
DROP POLICY IF EXISTS "System inserts profiles" ON public.profiles;
DROP POLICY IF EXISTS "System inserts roles" ON public.user_roles;

-- Profiles: allow insert only when user_id matches auth.uid() (trigger will handle it via security definer)
-- Since the handle_new_user trigger uses SECURITY DEFINER, it bypasses RLS
-- We need a policy that allows the trigger to insert; use a safe approach
CREATE POLICY "Allow profile insert for own user" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User_roles: restrict insert to own user or admin
CREATE POLICY "Allow role insert for own user" ON public.user_roles
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());
