# A4 — Search & Pagination: EXPLAIN ANALYZE Evidence

Seeded dataset: 10,000 products across 20 sellers, ~1,200-1,300 per category (8 categories),
90% available, prices randomized between 500-20,500 cents.

## Query 1: Search + category + price range + availability filter

```sql
explain analyze
select *
from products
where is_archived = false
  and category = 'Electronics'
  and is_available = true
  and price_cents between 1000 and 15000
  and name ilike '%Wireless%'
order by price_cents asc
limit 10 offset 0;
```

**Result:** Planner used `idx_products_category_available_price` (the composite partial
index on category, is_available, price_cents where is_archived = false) to narrow the
candidate rows to ~58, then applied the `name ILIKE` text filter directly against that
small set rather than consulting the trigram index. Execution time: 0.83ms.

**Interpretation:** when a query combines a selective filter (category + price range) with
a broader text search, Postgres correctly prefers narrowing via the most selective index
first, then filtering the (already small) remaining set directly, rather than combining
two separate index lookups.

## Query 2: Text search alone, no other filters

```sql
explain analyze
select *
from products
where is_archived = false
  and name ilike '%Wireless%'
limit 10;
```

**Result:** Planner chose a sequential scan over the trigram index (`idx_products_name_trgm`),
despite the index existing. Execution time: 0.29ms.

**Interpretation:** at ~10k rows, scanning the table sequentially is cheap enough that the
planner judges it faster than the overhead of an index lookup — this is expected, correct
planner behavior, not a sign the index is broken or badly designed. The trigram index becomes
valuable as table size grows well beyond this; at Reneo's stated scale (1M products), the same
query would very likely switch to using the index automatically, since the relative cost of a
full sequential scan grows much faster than an index lookup as row count increases. I did not
seed 1M rows to prove this directly (seeded 10k for practicality), but this is standard,
well-documented Postgres planner behavior — the index is correctly built and available for
when the planner's cost estimate favors it.

## Takeaway

Both results demonstrate index-aware design working as intended: selective filters use the
composite index; broad text search without other filters gracefully falls back to a sequential
scan at this table size, and would automatically switch to the trigram index at larger scale
without any code changes required.
