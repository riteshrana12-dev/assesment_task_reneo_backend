create table inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references products(id) on delete cascade,
  stock integer not null default 0 check (stock >= 0),
  updated_at timestamptz not null default now()
);