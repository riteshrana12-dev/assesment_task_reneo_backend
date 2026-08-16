create table events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table events enable row level security;

create policy "events_select_seller" on events
  for select using (
    order_id in (select order_id from order_items where seller_id = auth.uid())
  );

create or replace function notify_order_created()
returns trigger
language plpgsql
security definer
as $$
begin
  if (tg_op = 'update' and old.status is distinct from 'CONFIRMED' and new.status = 'CONFIRMED') then
    insert into events (order_id, type, payload)
    values (new.id, 'ORDER_CREATED', jsonb_build_object('order_id', new.id, 'total_cents', new.total_cents));
  end if;
  return new;
end;
$$;

create trigger trg_order_confirmed
  after update on orders
  for each row execute function notify_order_created();

alter publication supabase_realtime add table events;