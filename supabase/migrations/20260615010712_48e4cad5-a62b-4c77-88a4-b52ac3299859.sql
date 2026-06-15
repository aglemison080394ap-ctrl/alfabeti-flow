
CREATE TABLE public.fluency_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  teacher_name TEXT NOT NULL,
  class_label TEXT NOT NULL,
  school_name TEXT NOT NULL,
  school_year INTEGER NOT NULL,
  pl1 INTEGER NOT NULL DEFAULT 0 CHECK (pl1 >= 0),
  pl2 INTEGER NOT NULL DEFAULT 0 CHECK (pl2 >= 0),
  pl3 INTEGER NOT NULL DEFAULT 0 CHECK (pl3 >= 0),
  pl4 INTEGER NOT NULL DEFAULT 0 CHECK (pl4 >= 0),
  li INTEGER NOT NULL DEFAULT 0 CHECK (li >= 0),
  lf INTEGER NOT NULL DEFAULT 0 CHECK (lf >= 0),
  total INTEGER NOT NULL,
  ifl NUMERIC(4,2) NOT NULL,
  taxa_leitores NUMERIC(5,2) NOT NULL,
  classification TEXT NOT NULL,
  diagnostico TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fluency_simulations TO authenticated;
GRANT ALL ON public.fluency_simulations TO service_role;

ALTER TABLE public.fluency_simulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access fluency"
  ON public.fluency_simulations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Users manage own fluency simulations"
  ON public.fluency_simulations
  FOR ALL TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE INDEX idx_fluency_created_by ON public.fluency_simulations(created_by);
CREATE INDEX idx_fluency_class_id ON public.fluency_simulations(class_id);
CREATE INDEX idx_fluency_created_at ON public.fluency_simulations(created_at DESC);

CREATE TRIGGER update_fluency_simulations_updated_at
  BEFORE UPDATE ON public.fluency_simulations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
