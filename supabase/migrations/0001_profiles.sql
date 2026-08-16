create type user_role as enum ('SELLER', 'CUSTOMER');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  full_name text,
  created_at timestamptz not null default now()
);