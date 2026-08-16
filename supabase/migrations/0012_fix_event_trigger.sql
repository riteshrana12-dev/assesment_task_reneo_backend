create or replace function notify_order_created()
returns trigger
language plpgsql
security definer
as $$
begin
  if (TG_OP = 'UPDATE' and old.status is distinct from 'CONFIRMED' and new.status = 'CONFIRMED') then
    insert into events (order_id, type, payload)
    values (new.id, 'ORDER_CREATED', jsonb_build_object('order_id', new.id, 'total_cents', new.total_cents));
  end if;
  return new;
end;
$$;