
CREATE OR REPLACE FUNCTION public.has_any_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE role = 'admin' LIMIT 1
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_any_admin() TO anon, authenticated;
