-- Enable trigram search extension (for fuzzy/partial text search on product name)
create extension if not exists pg_trgm;

-- Text search on product name — trigram index supports ILIKE '%term%' style search
create index idx_products_name_trgm on products using gin (name gin_trgm_ops);

-- Filtering by category (exact match, very common filter)
create index idx_products_category on products(category);

-- Filtering by price range (min/max price) — btree is naturally good at range queries
create index idx_products_price_cents on products(price_cents);

-- Filtering by availability (boolean) — often combined with other filters
create index idx_products_is_available on products(is_available);

-- Common combined filter: browsing a category of available products, sorted by price
create index idx_products_category_available_price
  on products(category, is_available, price_cents)
  where is_archived = false;