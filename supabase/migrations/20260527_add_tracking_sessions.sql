CREATE TABLE public.tracking_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id      UUID        REFERENCES public.assets(id) ON DELETE SET NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  distance_km   FLOAT,
  elapsed_seconds INTEGER,
  route         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tracking_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own tracking sessions"
  ON public.tracking_sessions FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());
