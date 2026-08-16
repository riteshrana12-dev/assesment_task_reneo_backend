create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_products_updated_at
  before update on products
  for each row execute function set_updated_at();

create trigger trg_inventory_updated_at
  before update on inventory
  for each row execute function set_updated_at();

create trigger trg_orders_updated_at
  before update on orders
  for each row execute function set_updated_at();