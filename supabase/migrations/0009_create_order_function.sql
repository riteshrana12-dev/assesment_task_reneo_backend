create or replace function create_order(p_items jsonb, p_idempotency_key text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_order_id uuid;
  v_existing_order_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_quantity int;
  v_price_cents int;
  v_seller_id uuid;
  v_total_cents int := 0;
  v_updated_rows int;
begin
  if v_customer_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from profiles where id = v_customer_id and role = 'CUSTOMER') then
    raise exception 'Only customers can place orders' using errcode = '42501';
  end if;

  -- Idempotency check: if this key was already used by this customer, return the same order.
  if p_idempotency_key is not null then
    select id into v_existing_order_id
    from orders
    where idempotency_key = p_idempotency_key and customer_id = v_customer_id;

    if found then
      return v_existing_order_id;
    end if;
  end if;

  insert into orders (customer_id, status, total_cents, idempotency_key)
  values (v_customer_id, 'PENDING', 0, p_idempotency_key)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::int;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Invalid quantity for product %', v_product_id using errcode = '22023';
    end if;

    -- Resolve real price/seller server-side. Lock the product row so it can't
    -- be archived or repriced mid-transaction while we're using its values.
    select p.price_cents, s.owner_id
      into v_price_cents, v_seller_id
    from products p
    join stores s on s.id = p.store_id
    where p.id = v_product_id
      and p.is_archived = false
      and p.is_available = true
    for update of p;

    if not found then
      raise exception 'Product % not available', v_product_id using errcode = '42704';
    end if;

    -- The concurrency-safe step (B1): a single atomic, conditional UPDATE.
    -- If two requests race for the last unit, Postgres serializes the two
    -- UPDATEs on this row. The first to commit wins; the second re-evaluates
    -- "stock >= quantity" against the now-reduced value and affects 0 rows.
    update inventory
      set stock = stock - v_quantity,
          updated_at = now()
      where product_id = v_product_id
        and stock >= v_quantity;

    get diagnostics v_updated_rows = row_count;

    if v_updated_rows = 0 then
      raise exception 'Insufficient stock for product %', v_product_id using errcode = '23514';
    end if;

    insert into order_items (order_id, product_id, seller_id, quantity, unit_price_cents)
    values (v_order_id, v_product_id, v_seller_id, v_quantity, v_price_cents);

    v_total_cents := v_total_cents + (v_price_cents * v_quantity);
  end loop;

  update orders
    set total_cents = v_total_cents,
        status = 'CONFIRMED',
        updated_at = now()
  where id = v_order_id;

  return v_order_id;

exception
  when unique_violation then
    -- Two identical idempotency keys raced past the earlier check simultaneously.
    -- The unique constraint on orders.idempotency_key catches it here instead.
    select id into v_existing_order_id
    from orders
    where idempotency_key = p_idempotency_key and customer_id = v_customer_id;
    return v_existing_order_id;
end;
$$;

grant execute on function create_order(jsonb, text) to authenticated;