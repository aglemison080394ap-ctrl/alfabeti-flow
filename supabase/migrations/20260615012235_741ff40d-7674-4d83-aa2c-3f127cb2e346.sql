ALTER TABLE public.fluency_simulations
  ADD COLUMN IF NOT EXISTS matriculados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS participacao numeric(5,2) NOT NULL DEFAULT 0;