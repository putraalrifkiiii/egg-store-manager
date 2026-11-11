CREATE OR REPLACE FUNCTION public.create_sale(
  _items jsonb, _paid numeric, _method text DEFAULT 'tunai', _customer text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _sale_id uuid := gen_random_uuid();
  _invoice text;
  _item jsonb;
  _p public.products%ROWTYPE;
  _qty numeric;
  _total numeric := 0;
  _cost numeric := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Harus masuk terlebih dahulu'; END IF;
  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Keranjang kosong'; END IF;

  -- Pass 1: lock products, validate stock, compute totals
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item ->> 'quantity')::numeric;
    IF _qty IS NULL OR _qty <= 0 THEN RAISE EXCEPTION 'Jumlah tidak valid'; END IF;
    SELECT * INTO _p FROM public.products WHERE id = (_item ->> 'product_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produk tidak ditemukan'; END IF;
    IF _p.stock < _qty THEN RAISE EXCEPTION 'Stok % tidak cukup (sisa %)', _p.name, _p.stock; END IF;
    _total := _total + round(_p.price * _qty);
    _cost := _cost + round(_p.cost_price * _qty);
  END LOOP;

  IF coalesce(_paid, 0) < _total THEN RAISE EXCEPTION 'Uang dibayar kurang dari total'; END IF;

  _invoice := 'INV-' || to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYMMDD') || '-' || lpad(nextval('public.sales_invoice_seq')::text, 5, '0');

  INSERT INTO public.sales (id, invoice_no, total, cost_total, paid, change, payment_method, customer_name, cashier_id, cashier_email)
  VALUES (_sale_id, _invoice, _total, _cost, coalesce(_paid, 0), coalesce(_paid, 0) - _total, coalesce(_method, 'tunai'),
          nullif(trim(_customer), ''), _uid, auth.jwt() ->> 'email');

  -- Pass 2: record items and decrement stock
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item ->> 'quantity')::numeric;
    SELECT * INTO _p FROM public.products WHERE id = (_item ->> 'product_id')::uuid;
    IF _p.stock < _qty THEN RAISE EXCEPTION 'Stok % tidak cukup (sisa %)', _p.name, _p.stock; END IF;
    UPDATE public.products SET stock = stock - _qty WHERE id = _p.id;
    INSERT INTO public.sale_items (sale_id, product_id, product_name, unit, quantity, price, cost_price, subtotal)
    VALUES (_sale_id, _p.id, _p.name, _p.unit, _qty, _p.price, _p.cost_price, round(_p.price * _qty));
    INSERT INTO public.stock_movements (product_id, type, quantity, stock_after, note, created_by)
    VALUES (_p.id, 'sale', -_qty, _p.stock - _qty, _invoice, _uid);
  END LOOP;

  RETURN _sale_id;
END; $$;