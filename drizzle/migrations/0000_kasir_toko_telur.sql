-- Products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Ayam Ras',
  unit text NOT NULL DEFAULT 'kg',
  price numeric(14,0) NOT NULL DEFAULT 0 CHECK (price >= 0),
  cost_price numeric(14,0) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  stock numeric(14,2) NOT NULL DEFAULT 0,
  min_stock numeric(14,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff update products" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff delete products" ON public.products FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER products_touch BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Stock movements
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('in','out','adjust','sale')),
  quantity numeric(14,2) NOT NULL,
  stock_after numeric(14,2) NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read movements" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX stock_movements_created_idx ON public.stock_movements(created_at DESC);

-- Sales
CREATE SEQUENCE public.sales_invoice_seq;
GRANT USAGE ON SEQUENCE public.sales_invoice_seq TO authenticated;

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE,
  total numeric(14,0) NOT NULL DEFAULT 0,
  cost_total numeric(14,0) NOT NULL DEFAULT 0,
  paid numeric(14,0) NOT NULL DEFAULT 0,
  change numeric(14,0) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'tunai',
  customer_name text,
  cashier_id uuid,
  cashier_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX sales_created_idx ON public.sales(created_at DESC);

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  unit text NOT NULL,
  quantity numeric(14,2) NOT NULL,
  price numeric(14,0) NOT NULL,
  cost_price numeric(14,0) NOT NULL DEFAULT 0,
  subtotal numeric(14,0) NOT NULL
);
GRANT SELECT, INSERT ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read sale items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert sale items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX sale_items_sale_idx ON public.sale_items(sale_id);

-- Checkout: atomic sale + stock decrement
CREATE OR REPLACE FUNCTION public.create_sale(
  _items jsonb, _paid numeric, _method text DEFAULT 'tunai', _customer text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _sale_id uuid;
  _invoice text;
  _item jsonb;
  _p public.products%ROWTYPE;
  _qty numeric;
  _total numeric := 0;
  _cost numeric := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Harus masuk terlebih dahulu'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Keranjang kosong'; END IF;

  _invoice := 'INV-' || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYMMDD') || '-' || lpad(nextval('public.sales_invoice_seq')::text, 5, '0');

  INSERT INTO public.sales (invoice_no, payment_method, customer_name, cashier_id, cashier_email, paid)
  VALUES (_invoice, coalesce(_method, 'tunai'), nullif(trim(_customer), ''), _uid, auth.jwt() ->> 'email', coalesce(_paid, 0))
  RETURNING id INTO _sale_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item ->> 'quantity')::numeric;
    IF _qty IS NULL OR _qty <= 0 THEN RAISE EXCEPTION 'Jumlah tidak valid'; END IF;
    SELECT * INTO _p FROM public.products WHERE id = (_item ->> 'product_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produk tidak ditemukan'; END IF;
    IF _p.stock < _qty THEN RAISE EXCEPTION 'Stok % tidak cukup (sisa %)', _p.name, _p.stock; END IF;

    UPDATE public.products SET stock = stock - _qty WHERE id = _p.id;
    INSERT INTO public.sale_items (sale_id, product_id, product_name, unit, quantity, price, cost_price, subtotal)
    VALUES (_sale_id, _p.id, _p.name, _p.unit, _qty, _p.price, _p.cost_price, round(_p.price * _qty));
    INSERT INTO public.stock_movements (product_id, type, quantity, stock_after, note, created_by)
    VALUES (_p.id, 'sale', -_qty, _p.stock - _qty, _invoice, _uid);

    _total := _total + round(_p.price * _qty);
    _cost := _cost + round(_p.cost_price * _qty);
  END LOOP;

  IF coalesce(_paid, 0) < _total THEN RAISE EXCEPTION 'Uang dibayar kurang dari total'; END IF;

  UPDATE public.sales SET total = _total, cost_total = _cost, change = coalesce(_paid,0) - _total WHERE id = _sale_id;
  RETURN _sale_id;
END; $$;

-- Stock adjustment
CREATE OR REPLACE FUNCTION public.adjust_stock(
  _product_id uuid, _type text, _quantity numeric, _note text DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _current numeric;
  _new numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Harus masuk terlebih dahulu'; END IF;
  IF _quantity IS NULL OR _quantity < 0 THEN RAISE EXCEPTION 'Jumlah tidak valid'; END IF;
  SELECT stock INTO _current FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produk tidak ditemukan'; END IF;

  IF _type = 'in' THEN _new := _current + _quantity;
  ELSIF _type = 'out' THEN
    IF _quantity > _current THEN RAISE EXCEPTION 'Stok tidak cukup (sisa %)', _current; END IF;
    _new := _current - _quantity;
  ELSIF _type = 'adjust' THEN _new := _quantity;
  ELSE RAISE EXCEPTION 'Jenis tidak valid';
  END IF;

  UPDATE public.products SET stock = _new WHERE id = _product_id;
  INSERT INTO public.stock_movements (product_id, type, quantity, stock_after, note, created_by)
  VALUES (_product_id, _type, _new - _current, _new, nullif(trim(_note), ''), _uid);
  RETURN _new;
END; $$;

-- Reports
CREATE OR REPLACE FUNCTION public.sales_daily(_from date, _to date)
RETURNS TABLE (day date, revenue numeric, profit numeric, transactions bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT d::date AS day,
    coalesce(sum(s.total), 0) AS revenue,
    coalesce(sum(s.total - s.cost_total), 0) AS profit,
    count(s.id) AS transactions
  FROM generate_series(_from, _to, interval '1 day') d
  LEFT JOIN public.sales s ON (s.created_at AT TIME ZONE 'Asia/Jakarta')::date = d::date
  GROUP BY d ORDER BY d;
$$;

CREATE OR REPLACE FUNCTION public.top_products(_from date, _to date, _limit int DEFAULT 10)
RETURNS TABLE (product_name text, unit text, quantity numeric, revenue numeric, profit numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT i.product_name, i.unit, sum(i.quantity), sum(i.subtotal), sum(i.subtotal - round(i.cost_price * i.quantity))
  FROM public.sale_items i JOIN public.sales s ON s.id = i.sale_id
  WHERE (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN _from AND _to
  GROUP BY i.product_name, i.unit
  ORDER BY sum(i.subtotal) DESC
  LIMIT _limit;
$$;

CREATE OR REPLACE FUNCTION public.payment_breakdown(_from date, _to date)
RETURNS TABLE (payment_method text, transactions bigint, revenue numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT s.payment_method, count(*), sum(s.total)
  FROM public.sales s
  WHERE (s.created_at AT TIME ZONE 'Asia/Jakarta')::date BETWEEN _from AND _to
  GROUP BY s.payment_method ORDER BY sum(s.total) DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.create_sale(jsonb, numeric, text, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(uuid, text, numeric, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.sales_daily(date, date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.top_products(date, date, int) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.payment_breakdown(date, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_sale(jsonb, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sales_daily(date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.top_products(date, date, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.payment_breakdown(date, date) TO authenticated;

-- Starter catalogue
INSERT INTO public.products (name, category, unit, price, cost_price, stock, min_stock) VALUES
  ('Telur Ayam Ras', 'Ayam Ras', 'kg', 29000, 26000, 150, 30),
  ('Telur Ayam Ras Tray (30 butir)', 'Ayam Ras', 'tray', 55000, 50000, 25, 5),
  ('Telur Ayam Ras Peti (15 kg)', 'Ayam Ras', 'peti', 420000, 385000, 10, 3),
  ('Telur Ayam Kampung', 'Ayam Kampung', 'butir', 2500, 2000, 300, 60),
  ('Telur Bebek', 'Bebek', 'butir', 3000, 2400, 200, 50),
  ('Telur Puyuh (isi 10)', 'Puyuh', 'pack', 5000, 3800, 80, 20),
  ('Telur Asin', 'Olahan', 'butir', 4500, 3500, 60, 20),
  ('Telur Omega (isi 10)', 'Ayam Ras', 'pack', 32000, 27000, 4, 10);