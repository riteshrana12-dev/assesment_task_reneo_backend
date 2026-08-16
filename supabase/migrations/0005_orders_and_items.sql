create type order_status as enum ('PENDING', 'CONFIRMED', 'CANCELLED');

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  status order_status not null default 'PENDING',
  total_cents integer not null check (total_cents >= 0),
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_customer_id on orders(customer_id);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  seller_id uuid not null references profiles(id),
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now()
);

create index idx_order_items_order_id on order_items(order_id);
create index idx_order_items_seller_id on order_items(seller_id);