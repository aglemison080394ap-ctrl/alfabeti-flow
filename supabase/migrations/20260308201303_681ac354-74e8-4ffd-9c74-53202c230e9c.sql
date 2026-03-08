
-- Fix 1: Drop all RESTRICTIVE policies and recreate as PERMISSIVE

-- ====== ASSESSMENTS ======
DROP POLICY IF EXISTS "Admins can manage assessments" ON public.assessments;
DROP POLICY IF EXISTS "Authenticated users can view assessments" ON public.assessments;
DROP POLICY IF EXISTS "Teachers manage assessments for their students" ON public.assessments;

CREATE POLICY "Admins full access assessments" ON public.assessments FOR ALL USING (is_admin());
CREATE POLICY "Teachers manage assessments for their students" ON public.assessments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM students s
    JOIN classes c ON s.class_id = c.id
    JOIN teachers t ON c.teacher_id = t.id
    WHERE s.id = assessments.student_id AND t.user_id = auth.uid()
  ));
CREATE POLICY "Authenticated users view assessments" ON public.assessments FOR SELECT USING (auth.role() = 'authenticated');

-- ====== CLASSES ======
DROP POLICY IF EXISTS "Admins can manage classes" ON public.classes;
DROP POLICY IF EXISTS "Authenticated users can view classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers manage their classes" ON public.classes;

CREATE POLICY "Admins full access classes" ON public.classes FOR ALL USING (is_admin());
CREATE POLICY "Teachers manage their classes" ON public.classes FOR ALL
  USING (EXISTS (
    SELECT 1 FROM teachers t
    WHERE t.id = classes.teacher_id AND t.user_id = auth.uid()
  ));
CREATE POLICY "Authenticated users view classes" ON public.classes FOR SELECT USING (auth.role() = 'authenticated');

-- ====== STUDENTS ======
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
DROP POLICY IF EXISTS "Authenticated users can view students" ON public.students;
DROP POLICY IF EXISTS "Teachers manage students in their classes" ON public.students;

CREATE POLICY "Admins full access students" ON public.students FOR ALL USING (is_admin());
CREATE POLICY "Teachers manage students in their classes" ON public.students FOR ALL
  USING (EXISTS (
    SELECT 1 FROM classes c
    JOIN teachers t ON c.teacher_id = t.id
    WHERE c.id = students.class_id AND t.user_id = auth.uid()
  ));
CREATE POLICY "Authenticated users view students" ON public.students FOR SELECT USING (auth.role() = 'authenticated');

-- ====== TEACHERS ======
DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;
DROP POLICY IF EXISTS "Authenticated users can view teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can update own record" ON public.teachers;

CREATE POLICY "Admins full access teachers" ON public.teachers FOR ALL USING (is_admin());
CREATE POLICY "Teachers can update own record" ON public.teachers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users view teachers" ON public.teachers FOR SELECT USING (auth.role() = 'authenticated');

-- ====== SCHOOL INFO ======
DROP POLICY IF EXISTS "Admins can update school info" ON public.school_info;
DROP POLICY IF EXISTS "Everyone can view school info" ON public.school_info;

CREATE POLICY "Admins full access school info" ON public.school_info FOR ALL USING (is_admin());
CREATE POLICY "Everyone can view school info" ON public.school_info FOR SELECT USING (true);

-- ====== PROFILES ======
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile insert for own user" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Admins full access profiles" ON public.profiles FOR ALL USING (is_admin());
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Allow profile insert for own user" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ====== USER_ROLES ======
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow role insert for own user" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Admins full access user_roles" ON public.user_roles FOR ALL USING (is_admin());
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Allow role insert for own user" ON public.user_roles FOR INSERT WITH CHECK ((auth.uid() = user_id) OR is_admin());

-- Fix 2: Add the missing handle_new_user trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
