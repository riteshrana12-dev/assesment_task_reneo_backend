-- PROFILES
alter table profiles enable row level security;

create policy "profiles_select_own" on profiles
  for select using (id = auth.uid());

create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

create policy "profiles_insert_own" on profiles
  for insert with check (id = auth.uid());

-- STORES
alter table stores enable row level security;

create policy "stores_select_all" on stores
  for select using (true);

create policy "stores_insert_own" on stores
  for insert with check (
    owner_id = auth.uid()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'SELLER')
  );

create policy "stores_update_own" on stores
  for update using (owner_id = auth.uid());

create policy "stores_delete_own" on stores
  for delete using (owner_id = auth.uid());

-- PRODUCTS
alter table products enable row level security;

create policy "products_select_public_or_own" on products
  for select using (
    is_archived = false
    or store_id in (select id from stores where owner_id = auth.uid())
  );

create policy "products_insert_own_store" on products
  for insert with check (
    store_id in (select id from stores where owner_id = auth.uid())
  );

create policy "products_update_own_store" on products
  for update using (
    store_id in (select id from stores where owner_id = auth.uid())
  );

create policy "products_delete_own_store" on products
  for delete using (
    store_id in (select id from stores where owner_id = auth.uid())
  );

-- INVENTORY
alter table inventory enable row level security;

create policy "inventory_select_own" on inventory
  for select using (
    product_id in (
      select id from products where store_id in (select id from stores where owner_id = auth.uid())
    )
  );

create policy "inventory_insert_own" on inventory
  for insert with check (
    product_id in (
      select id from products where store_id in (select id from stores where owner_id = auth.uid())
    )
  );

create policy "inventory_update_own" on inventory
  for update using (
    product_id in (
      select id from products where store_id in (select id from stores where owner_id = auth.uid())
    )
  );

-- ORDERS
alter table orders enable row level security;

create policy "orders_select_own_customer" on orders
  for select using (customer_id = auth.uid());

-- Deliberately no insert/update/delete policy here.
-- Orders can ONLY be created via the create_order() function (see 0009),
-- which runs as SECURITY DEFINER and enforces price/stock integrity server-side.
-- Direct table writes from any client are denied by default.

-- ORDER_ITEMS
alter table order_items enable row level security;

create policy "order_items_select_customer" on order_items
  for select using (
    order_id in (select id from orders where customer_id = auth.uid())
  );

create policy "order_items_select_seller" on order_items
  for select using (seller_id = auth.uid());

-- Same reasoning as orders: no direct insert/update/delete.
-- Written exclusively by create_order().