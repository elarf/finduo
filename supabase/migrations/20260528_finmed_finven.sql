-- ============================================================
-- FINMED: Medication Management
-- FINVEN: Household Inventory / Food Management
-- ============================================================

-- ============================================================
-- FINMED TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.finmed_medications (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT        NOT NULL,
  form                 TEXT        NOT NULL,
  unit                 TEXT        NOT NULL,
  stock_quantity       NUMERIC     NOT NULL DEFAULT 0,
  stock_low_threshold  NUMERIC     NOT NULL DEFAULT 0,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finmed_schedules (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id  UUID        NOT NULL REFERENCES public.finmed_medications(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type           TEXT        NOT NULL CHECK (type IN ('finite', 'ongoing')),
  dose_amount    NUMERIC     NOT NULL,
  dose_unit      TEXT        NOT NULL,
  times_per_day  INTEGER     NOT NULL,
  times_of_day   JSONB       NOT NULL DEFAULT '[]',
  start_date     DATE        NOT NULL,
  end_date       DATE,
  active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finmed_intake_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id  UUID        NOT NULL REFERENCES public.finmed_medications(id) ON DELETE CASCADE,
  schedule_id    UUID        REFERENCES public.finmed_schedules(id) ON DELETE SET NULL,
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  taken_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dose_amount    NUMERIC     NOT NULL,
  note           TEXT
);

CREATE TABLE IF NOT EXISTS public.finmed_stock_transactions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id    UUID        NOT NULL REFERENCES public.finmed_medications(id) ON DELETE CASCADE,
  transaction_id   UUID        NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity_added   NUMERIC     NOT NULL,
  price_allocated  NUMERIC     NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FINVEN TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.finven_locations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  icon        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finven_products (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  barcode        TEXT,
  default_unit   TEXT        NOT NULL,
  category_hint  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- finven_transaction_items must be created before finven_stock_items (back-ref FK)
CREATE TABLE IF NOT EXISTS public.finven_transaction_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id   UUID        NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id       UUID        NOT NULL REFERENCES public.finven_products(id) ON DELETE RESTRICT,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quantity         NUMERIC     NOT NULL,
  unit             TEXT        NOT NULL,
  price_allocated  NUMERIC     NOT NULL,
  expiry_date      DATE,
  location_id      UUID        REFERENCES public.finven_locations(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- stock_items.transaction_item_id is a nullable back-ref to transaction_items.
-- Application layer is responsible for upserting a stock_item row when a
-- transaction_item is inserted (no trigger defined here to keep logic explicit).
CREATE TABLE IF NOT EXISTS public.finven_stock_items (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           UUID        NOT NULL REFERENCES public.finven_products(id) ON DELETE RESTRICT,
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id          UUID        REFERENCES public.finven_locations(id) ON DELETE SET NULL,
  quantity             NUMERIC     NOT NULL DEFAULT 0,
  unit                 TEXT        NOT NULL,
  expiry_date          DATE,
  low_stock_threshold  NUMERIC,
  transaction_item_id  UUID        REFERENCES public.finven_transaction_items(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finven_shopping_list (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id    UUID        REFERENCES public.finven_products(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL,
  quantity      NUMERIC,
  unit          TEXT,
  added_reason  TEXT        NOT NULL CHECK (added_reason IN ('manual', 'low_stock', 'expiry')),
  checked       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_finmed_medications_user_id              ON public.finmed_medications(user_id);
CREATE INDEX IF NOT EXISTS idx_finmed_schedules_medication_id          ON public.finmed_schedules(medication_id);
CREATE INDEX IF NOT EXISTS idx_finmed_schedules_user_id                ON public.finmed_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_finmed_intake_logs_medication_id        ON public.finmed_intake_logs(medication_id);
CREATE INDEX IF NOT EXISTS idx_finmed_intake_logs_schedule_id          ON public.finmed_intake_logs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_finmed_intake_logs_user_id              ON public.finmed_intake_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_finmed_stock_transactions_medication_id ON public.finmed_stock_transactions(medication_id);
CREATE INDEX IF NOT EXISTS idx_finmed_stock_transactions_transaction_id ON public.finmed_stock_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_finmed_stock_transactions_user_id       ON public.finmed_stock_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_finven_locations_user_id                  ON public.finven_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_finven_products_user_id                   ON public.finven_products(user_id);
CREATE INDEX IF NOT EXISTS idx_finven_transaction_items_transaction_id   ON public.finven_transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_finven_transaction_items_product_id       ON public.finven_transaction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_finven_transaction_items_user_id          ON public.finven_transaction_items(user_id);
CREATE INDEX IF NOT EXISTS idx_finven_transaction_items_location_id      ON public.finven_transaction_items(location_id);
CREATE INDEX IF NOT EXISTS idx_finven_stock_items_product_id             ON public.finven_stock_items(product_id);
CREATE INDEX IF NOT EXISTS idx_finven_stock_items_user_id                ON public.finven_stock_items(user_id);
CREATE INDEX IF NOT EXISTS idx_finven_stock_items_location_id            ON public.finven_stock_items(location_id);
CREATE INDEX IF NOT EXISTS idx_finven_stock_items_transaction_item_id    ON public.finven_stock_items(transaction_item_id);
CREATE INDEX IF NOT EXISTS idx_finven_shopping_list_user_id              ON public.finven_shopping_list(user_id);
CREATE INDEX IF NOT EXISTS idx_finven_shopping_list_product_id           ON public.finven_shopping_list(product_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.finmed_medications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finmed_schedules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finmed_intake_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finmed_stock_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finven_locations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finven_products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finven_transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finven_stock_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finven_shopping_list     ENABLE ROW LEVEL SECURITY;

-- finmed_medications
CREATE POLICY "finmed_medications_select" ON public.finmed_medications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "finmed_medications_insert" ON public.finmed_medications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "finmed_medications_update" ON public.finmed_medications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "finmed_medications_delete" ON public.finmed_medications FOR DELETE USING (auth.uid() = user_id);

-- finmed_schedules
CREATE POLICY "finmed_schedules_select" ON public.finmed_schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "finmed_schedules_insert" ON public.finmed_schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "finmed_schedules_update" ON public.finmed_schedules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "finmed_schedules_delete" ON public.finmed_schedules FOR DELETE USING (auth.uid() = user_id);

-- finmed_intake_logs
CREATE POLICY "finmed_intake_logs_select" ON public.finmed_intake_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "finmed_intake_logs_insert" ON public.finmed_intake_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "finmed_intake_logs_update" ON public.finmed_intake_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "finmed_intake_logs_delete" ON public.finmed_intake_logs FOR DELETE USING (auth.uid() = user_id);

-- finmed_stock_transactions
CREATE POLICY "finmed_stock_transactions_select" ON public.finmed_stock_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "finmed_stock_transactions_insert" ON public.finmed_stock_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "finmed_stock_transactions_update" ON public.finmed_stock_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "finmed_stock_transactions_delete" ON public.finmed_stock_transactions FOR DELETE USING (auth.uid() = user_id);

-- finven_locations
CREATE POLICY "finven_locations_select" ON public.finven_locations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "finven_locations_insert" ON public.finven_locations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "finven_locations_update" ON public.finven_locations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "finven_locations_delete" ON public.finven_locations FOR DELETE USING (auth.uid() = user_id);

-- finven_products
CREATE POLICY "finven_products_select" ON public.finven_products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "finven_products_insert" ON public.finven_products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "finven_products_update" ON public.finven_products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "finven_products_delete" ON public.finven_products FOR DELETE USING (auth.uid() = user_id);

-- finven_transaction_items
CREATE POLICY "finven_transaction_items_select" ON public.finven_transaction_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "finven_transaction_items_insert" ON public.finven_transaction_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "finven_transaction_items_update" ON public.finven_transaction_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "finven_transaction_items_delete" ON public.finven_transaction_items FOR DELETE USING (auth.uid() = user_id);

-- finven_stock_items
CREATE POLICY "finven_stock_items_select" ON public.finven_stock_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "finven_stock_items_insert" ON public.finven_stock_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "finven_stock_items_update" ON public.finven_stock_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "finven_stock_items_delete" ON public.finven_stock_items FOR DELETE USING (auth.uid() = user_id);

-- finven_shopping_list
CREATE POLICY "finven_shopping_list_select" ON public.finven_shopping_list FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "finven_shopping_list_insert" ON public.finven_shopping_list FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "finven_shopping_list_update" ON public.finven_shopping_list FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "finven_shopping_list_delete" ON public.finven_shopping_list FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- GRANTS
-- ============================================================

GRANT ALL ON public.finmed_medications        TO authenticated, service_role;
GRANT ALL ON public.finmed_schedules          TO authenticated, service_role;
GRANT ALL ON public.finmed_intake_logs        TO authenticated, service_role;
GRANT ALL ON public.finmed_stock_transactions TO authenticated, service_role;
GRANT ALL ON public.finven_locations          TO authenticated, service_role;
GRANT ALL ON public.finven_products           TO authenticated, service_role;
GRANT ALL ON public.finven_transaction_items  TO authenticated, service_role;
GRANT ALL ON public.finven_stock_items        TO authenticated, service_role;
GRANT ALL ON public.finven_shopping_list      TO authenticated, service_role;
