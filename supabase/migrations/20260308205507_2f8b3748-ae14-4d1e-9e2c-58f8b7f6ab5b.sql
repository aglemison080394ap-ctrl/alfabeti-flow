
-- Drop all existing restrictive policies and recreate as PERMISSIVE

-- assessments
DROP POLICY IF EXISTS "Admins full access assessments" ON public.assessments;
DROP POLICY IF EXISTS "Teachers manage assessments for their students" ON public.assessments;
DROP POLICY IF EXISTS "Authenticated users view assessments" ON public.assessments;

CREATE POLICY "Admins full access assessments" ON public.assessments
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Teachers manage assessments for their students" ON public.assessments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM students s
    JOIN classes c ON s.class_id = c.id
    JOIN teachers t ON c.teacher_id = t.id
    WHERE s.id = assessments.student_id AND t.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM students s
    JOIN classes c ON s.class_id = c.id
    JOIN teachers t ON c.teacher_id = t.id
    WHERE s.id = assessments.student_id AND t.user_id = auth.uid()
  ));

CREATE POLICY "Authenticated users view assessments" ON public.assessments
  FOR SELECT TO authenticated USING (true);

-- classes
DROP POLICY IF EXISTS "Admins full access classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers manage their classes" ON public.classes;
DROP POLICY IF EXISTS "Authenticated users view classes" ON public.classes;

CREATE POLICY "Admins full access classes" ON public.classes
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Teachers manage their classes" ON public.classes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM teachers t WHERE t.id = classes.teacher_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM teachers t WHERE t.id = classes.teacher_id AND t.user_id = auth.uid()));

CREATE POLICY "Authenticated users view classes" ON public.classes
  FOR SELECT TO authenticated USING (true);

-- students
DROP POLICY IF EXISTS "Admins full access students" ON public.students;
DROP POLICY IF EXISTS "Teachers manage students in their classes" ON public.students;
DROP POLICY IF EXISTS "Authenticated users view students" ON public.students;

CREATE POLICY "Admins full access students" ON public.students
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Teachers manage students in their classes" ON public.students
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM classes c
    JOIN teachers t ON c.teacher_id = t.id
    WHERE c.id = students.class_id AND t.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM classes c
    JOIN teachers t ON c.teacher_id = t.id
    WHERE c.id = students.class_id AND t.user_id = auth.uid()
  ));

CREATE POLICY "Authenticated users view students" ON public.students
  FOR SELECT TO authenticated USING (true);

-- teachers
DROP POLICY IF EXISTS "Admins full access teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can update own record" ON public.teachers;
DROP POLICY IF EXISTS "Authenticated users view teachers" ON public.teachers;

CREATE POLICY "Admins full access teachers" ON public.teachers
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Teachers can update own record" ON public.teachers
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users view teachers" ON public.teachers
  FOR SELECT TO authenticated USING (true);

-- profiles
DROP POLICY IF EXISTS "Admins full access profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile insert for own user" ON public.profiles;

CREATE POLICY "Admins full access profiles" ON public.profiles
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow profile insert for own user" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- user_roles
DROP POLICY IF EXISTS "Admins full access user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Allow role insert for own user" ON public.user_roles;

CREATE POLICY "Admins full access user_roles" ON public.user_roles
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow role insert for own user" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id) OR is_admin());

-- school_info
DROP POLICY IF EXISTS "Admins full access school info" ON public.school_info;
DROP POLICY IF EXISTS "Everyone can view school info" ON public.school_info;

CREATE POLICY "Admins full access school info" ON public.school_info
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Everyone can view school info" ON public.school_info
  FOR SELECT USING (true);

-- Also create the trigger that was missing
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
