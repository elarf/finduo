-- ============================================================
-- FINMED: Cyclic schedules + unified reminder system
-- ============================================================

-- Extend finmed_schedules with cyclic support
ALTER TABLE public.finmed_schedules
  ADD COLUMN IF NOT EXISTS cycle_intake_days INTEGER,
  ADD COLUMN IF NOT EXISTS cycle_pause_days  INTEGER;

-- ============================================================
-- finmed_reminders — unified reminder config
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finmed_reminders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type             TEXT        NOT NULL CHECK (type IN ('medication', 'measurement', 'symptom_check', 'appointment')),
  label            TEXT        NOT NULL,
  frequency_type   TEXT        NOT NULL CHECK (frequency_type IN ('interval', 'multiple_times_daily', 'specific_day_of_week', 'cyclic', 'on_demand')),
  frequency_config JSONB       NOT NULL DEFAULT '{}'::jsonb,
  start_date       DATE        NOT NULL,
  end_date         DATE,
  active           BOOLEAN     NOT NULL DEFAULT TRUE,
  type_config      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- finmed_reminder_logs — log of all reminder interactions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finmed_reminder_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id    UUID        NOT NULL REFERENCES public.finmed_reminders(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_for  TIMESTAMPTZ NOT NULL,
  action         TEXT        NOT NULL CHECK (action IN ('complete', 'ignore', 'snooze')),
  completed_at   TIMESTAMPTZ,
  ignored_at     TIMESTAMPTZ,
  snoozed_until  TIMESTAMPTZ,
  value          JSONB,
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- finmed_persistent_symptoms — symptoms that persist across logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finmed_persistent_symptoms (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symptom_name  TEXT        NOT NULL,
  is_custom     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, symptom_name)
);

-- ============================================================
-- finmed_custom_symptoms — user-defined symptom names
-- ============================================================
CREATE TABLE IF NOT EXISTS public.finmed_custom_symptoms (
  id       UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name     TEXT  NOT NULL,
  UNIQUE (user_id, name)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_finmed_reminders_user_id          ON public.finmed_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_finmed_reminders_type             ON public.finmed_reminders(type);
CREATE INDEX IF NOT EXISTS idx_finmed_reminder_logs_reminder_id  ON public.finmed_reminder_logs(reminder_id);
CREATE INDEX IF NOT EXISTS idx_finmed_reminder_logs_user_id      ON public.finmed_reminder_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_finmed_reminder_logs_scheduled    ON public.finmed_reminder_logs(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_finmed_persistent_symptoms_user   ON public.finmed_persistent_symptoms(user_id);
CREATE INDEX IF NOT EXISTS idx_finmed_custom_symptoms_user       ON public.finmed_custom_symptoms(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.finmed_reminders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finmed_reminder_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finmed_persistent_symptoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finmed_custom_symptoms    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finmed_reminders_select"   ON public.finmed_reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "finmed_reminders_insert"   ON public.finmed_reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "finmed_reminders_update"   ON public.finmed_reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "finmed_reminders_delete"   ON public.finmed_reminders FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "finmed_reminder_logs_select" ON public.finmed_reminder_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "finmed_reminder_logs_insert" ON public.finmed_reminder_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "finmed_reminder_logs_update" ON public.finmed_reminder_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "finmed_reminder_logs_delete" ON public.finmed_reminder_logs FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "finmed_persistent_symptoms_select" ON public.finmed_persistent_symptoms FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "finmed_persistent_symptoms_insert" ON public.finmed_persistent_symptoms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "finmed_persistent_symptoms_update" ON public.finmed_persistent_symptoms FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "finmed_persistent_symptoms_delete" ON public.finmed_persistent_symptoms FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "finmed_custom_symptoms_select" ON public.finmed_custom_symptoms FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "finmed_custom_symptoms_insert" ON public.finmed_custom_symptoms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "finmed_custom_symptoms_update" ON public.finmed_custom_symptoms FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "finmed_custom_symptoms_delete" ON public.finmed_custom_symptoms FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- GRANTS
-- ============================================================
GRANT ALL ON public.finmed_reminders           TO authenticated, service_role;
GRANT ALL ON public.finmed_reminder_logs       TO authenticated, service_role;
GRANT ALL ON public.finmed_persistent_symptoms TO authenticated, service_role;
GRANT ALL ON public.finmed_custom_symptoms     TO authenticated, service_role;
