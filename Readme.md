# Reneo — Backend Developer Intern Assessment

Backend API for a slice of Reneo's multi-seller commerce platform. Node.js + TypeScript +
Express + Supabase (PostgreSQL, Auth, RLS).

## Stack

- Node.js / TypeScript / Express
- Supabase (Postgres, Auth, Row Level Security, Realtime)
- Raw SQL migrations (no ORM) — chosen deliberately; see "Design Decisions" below
- Jest + Supertest for automated tests

## Setup

1. Clone the repo, `cd` into it, `npm install`.
2. Create a Supabase project. Copy `.env.example` to `.env` and fill in:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (only needed for the seed script and test setup — the
     running API itself never uses it for regular requests)
3. Install the Supabase CLI, `supabase login`, `supabase link --project-ref <your-ref>`.
4. Apply the schema: `supabase db push` (applies every file in `supabase/migrations/` in order).
5. Run the API: `npm run dev` (starts on `PORT` from `.env`, default 3000).
6. (Optional) Seed realistic data volume for search/pagination testing: `npm run seed`
   (inserts ~10,000 products across 20 sellers — see "A4" below for why 10k, not 1M).
7. Run tests: `npm test` (requires the schema to be applied and the Supabase project
   reachable — tests hit a real Supabase instance, not a mock).

## Architecture

```
Client → Express (auth middleware, validation, controllers)
              ↓
       Supabase client (RLS-respecting, built per-request from the caller's JWT)
              ↓
       Postgres (RLS policies, constraints, the create_order() function)
```

Two Supabase clients exist (`src/config/supabase.ts`):

- **Per-request client** (anon key + caller's JWT) — used for all normal reads/writes.
  RLS applies, so `auth.uid()` inside Postgres resolves to the real caller.
- **Service-role client** — bypasses RLS. Used only in the seed script and test setup
  for operations that legitimately need to act outside any one user's permissions
  (e.g. creating many fake sellers). Never used in a regular request path.

Folder structure: `src/routes` → `src/controllers` (HTTP concerns only) → `src/services`
(business logic) → Supabase. `supabase/migrations/` is the single source of truth for
the schema, in numbered, sequential files.

## Design decisions and assumptions

- **Money stored as integers** (`price_cents`, `total_cents`, `unit_price_cents`) —
  smallest currency unit, never a float, to avoid rounding errors entirely.
- **One store per seller**, auto-created on their first product (`getOrCreateSellerStore`
  in `products.service.ts`). The brief didn't specify multi-store support and nothing
  in the tasks required it, so I kept this simple rather than building unused
  store-management endpoints.
- **`inventory` is a separate table from `products`**, not a `stock` column on
  `products` — this keeps the concurrency-critical atomic update (B1) touching only
  a small, focused row, not the whole product record.
- **`unit_price_cents` is snapshotted onto `order_items` at order time**, not derived
  by joining `products.price_cents` live — so a later price change never retroactively
  changes a past order's total. This is the core mechanism behind A5.
- **`seller_id` is denormalized onto `order_items`**, even though it's derivable via
  `product → store → owner`. Reneo's model allows one order to span multiple sellers, so
  this avoids a multi-table join for "show this seller their line items," and makes the
  RLS policy on `order_items` a simple direct comparison instead of a nested subquery.
- **Products are archived (`is_archived = true`), not hard-deleted**, since order_items
  reference product rows and should never point at data that's disappeared.
- **`orders` and `order_items` have no direct INSERT/UPDATE RLS policy at all.** The
  only way to create an order is through the `create_order()` Postgres function
  (SECURITY DEFINER), which resolves price/stock/seller from the database itself.
  This is the real enforcement mechanism behind A5 — RLS alone can't stop a client from
  setting an arbitrary price on a direct insert, so writes are denied by default and
  funneled through one trusted, atomic entry point instead.

## A4 — Search, pagination, and index evidence

Full EXPLAIN ANALYZE output and interpretation: [`docs/explain-output.md`](docs/explain-output.md).

Seeded 10,000 products (not the stated 1M) to keep seeding fast while still giving the
query planner enough data to make real cost-based decisions. At 10k rows, a combined
category+price+availability filter correctly uses the composite partial index
(`idx_products_category_available_price`); a broad text search with no other filters
falls back to a sequential scan, which is correct planner behavior at this table size —
the trigram index (`idx_products_name_trgm`) exists and would be used automatically as
row count grows toward Reneo's actual scale, without any code changes.

## A6 — Row Level Security

Policies are in `supabase/migrations/0008_rls_policies.sql`. Verified two ways, not just
assumed from reading the SQL:

1. Directly in Postgres, simulating a JWT via `set request.jwt.claims`, confirming a raw
   `UPDATE` from a non-owner affects 0 rows.
2. Through the live API — a real cross-seller PATCH request correctly returns 404 (not
   403 — see below), confirmed in `tests/products.test.ts`.

**Why 404, not 403, for a non-owner's product access attempt:** RLS filters the row out
of what's visible to the caller rather than throwing a permission error, so from the
API's perspective the row simply doesn't exist for that user. Returning 404 instead of
403 also avoids confirming to an attacker that a given product ID exists at all.

## B1 — Concurrency (`supabase/migrations/0009_create_order_function.sql`)

The stock decrement is a single atomic statement:

```sql
update inventory
  set stock = stock - v_quantity
  where product_id = v_product_id and stock >= v_quantity;
```

**What's atomic:** this one UPDATE statement. Postgres takes a row lock on the specific
`inventory` row for its duration. A second concurrent request targeting the same row
waits for the first to commit, then evaluates `stock >= quantity` against the
already-reduced value — so it correctly affects 0 rows if stock is now insufficient.

**What's locked, and for how long:** only the single inventory row being decremented,
only for the duration of that one statement — orders for different products never
block each other.

**What happens to the losing request:** `row_count = 0` after the UPDATE raises an
exception inside the function, which rolls back everything done in that call so far
(including the `PENDING` order row created earlier in the same transaction) — no
orphaned orders are left behind on failure.

**Alternative considered:** explicit `SELECT ... FOR UPDATE` followed by a separate
check-and-update. Rejected in favor of the single conditional UPDATE, which achieves
the same guarantee with less code and without holding a lock across multiple statements.

Verified manually (drained stock to 1, fired two real requests from separate terminals,
confirmed one 201 + one 409, stock landed at 0 not -1) before being encoded as the
automated test in `tests/concurrency.test.ts`, which fires two requests via `Promise.all`
so they genuinely race rather than running sequentially.

## B2 — Idempotency

`create_order()` accepts an optional idempotency key. On a repeat call with the same key
(same customer), it returns the existing order without re-decrementing stock or creating
a duplicate. A `unique` constraint on `orders.idempotency_key` is the actual guarantee —
even if two identical-key requests raced past the initial lookup simultaneously, the
constraint violation is caught and resolved to the same existing order (see the
`exception when unique_violation` block in the function).

Keys aren't currently expired/cleaned up — a real production version would want a TTL
or a periodic cleanup job, which I'd add given more time (see D2).

A same-key-different-payload request currently just returns the original order,
ignoring the new payload's contents — a stricter version would explicitly reject this
as a conflict; noted as a possible improvement rather than implemented, given the time cap.

## B3 — Events

An `AFTER UPDATE` trigger on `orders` inserts into an `events` table the moment an
order's status flips to `CONFIRMED`. Supabase Realtime is enabled on `events`, so a
seller-facing client could subscribe live.

**If the event insert fails:** it runs inside the same transaction as the order
confirmation, so a failure there would roll back the whole order — the order is never
left in a "confirmed but un-notified" state. This favors consistency over availability;
an alternative worth considering at scale is decoupling notification into a separate
outbox/queue so a notification failure can't block an order at all (see D1).

## Bugs found and fixed during testing

Testing surfaced several real issues, each found by an actual test or manual check
failing, not by code review alone:

- **Express 5 makes `req.query` read-only** — our validation middleware's reassignment
  pattern (copied from Express 4-era habits) threw a 500 on any GET route with query
  validation. Fixed by mutating `req.query` in place instead.
- **Missing base table grants for `service_role`/`authenticated`** — raw SQL migrations
  don't get Supabase's dashboard-default grants automatically; RLS policies alone don't
  grant table access, they only restrict it once access already exists. Fixed with an
  explicit `GRANT` migration.
- **`.strict()` on the order schema didn't apply to array items** — a client could smuggle
  an extra `price_cents` field inside an order item and have it silently stripped rather
  than rejected. Fixed by applying `.strict()` to the item schema as well as the outer object.
- **Event trigger compared `TG_OP` against lowercase `'update'`** — Postgres returns
  `'UPDATE'` (uppercase), so the comparison was always false and the trigger silently
  never fired, despite existing and looking correct on read. Found via the B3 automated
  test failing with zero events recorded; fixed in a follow-up migration.

## Part D

### D1 — Scaling to 10M users, millions of products, high order volume

See the architecture diagram (attached alongside this README). The current design's
core write path — Express API → connection pooler → Postgres primary — stays exactly
as-is at scale; everything added is additive scaling infrastructure around it, not a
rewrite.

**What breaks first:** the `inventory` row-locking approach in `create_order()` scales
fine per-product (locks are per-row, not table-wide), but a small number of extremely
high-demand products (flash sales) would see serialized contention on those specific
rows under very high concurrent load — a hot-row problem, not something the current
design solves at extreme scale.

**Priority order I'd address things in:**

1. **Read replicas** for product browsing/search (read-heavy, tolerant of slight
   staleness) — writes (orders, stock) stay on the primary.
2. **Connection pooling** (PgBouncer/Supabase's built-in pooler) — 10M users means far
   more concurrent connections than Postgres handles natively well.
3. **Caching layer** (Redis) in front of product reads — most product views don't need
   a live DB hit every time.
4. **Queue-based order processing** for the non-critical-path parts of order creation
   (the event/notification step specifically) — decouple B3 from the synchronous
   request path so a notification backend hiccup can't add latency to checkout.
5. **Partitioning** `orders`/`order_items` by time range once volume is large enough
   that a single table becomes unwieldy for maintenance (not urgent immediately).

**What I would not do yet:** sharding the database, or moving to a different database
entirely. Postgres with read replicas, pooling, and caching goes a very long way before
that's actually necessary, and premature sharding adds enormous complexity (cross-shard
queries, rebalancing) for a problem that better indexing/caching solves first. I'd only
reach for it once I had actual metrics showing the primary is write-bound and unable to
keep up — not preemptively.

**Monitoring:** p95/p99 latency on `/orders` (the concurrency-sensitive path), Postgres
lock wait time, connection pool saturation, and 409 rate on order creation (a spike
would indicate either a genuine flash-sale scenario or a bug).

### D2 — What I didn't have time for, and what I'd do next with two more days

- Idempotency key expiry/cleanup (currently keys live forever)
- Stricter same-key-different-payload handling for idempotency (currently just returns
  the original order silently rather than flagging the mismatch)
- Full-text search on `description`, not just `name`
- An outbox pattern for B3 instead of a same-transaction trigger, to decouple order
  confirmation from notification delivery entirely
- More exhaustive input validation edge cases (e.g. maximum order size, duplicate
  product_ids within a single order request)
- A proper OpenAPI spec generated from the zod schemas directly, rather than hand-written,
  to guarantee docs and validation never drift apart

### D3 — Where I used AI, and what I learned

_(Write this section yourself — it's asked in good faith and costs nothing to answer
honestly. Describe which parts you leaned on AI for structure or boilerplate versus
which parts — e.g. reasoning through the concurrency mechanism, debugging the Express 5
query issue, or catching the TG_OP casing bug — you worked through or had to understand
deeply enough to explain in the follow-up interview.)_

## Testing

`npm test` runs all suites (`tests/products.test.ts`, `tests/orders.test.ts`,
`tests/concurrency.test.ts`) against a real Supabase instance — 7 tests total, covering
all 5 required Part C scenarios plus B2 and B3. Tests hit real network calls (Auth
sign-in, Postgres), so they're slower than pure unit tests (~15-25s total) and
inherently less deterministic than an in-memory setup — a reasonable tradeoff for
directly proving RLS and the concurrency function work end-to-end, rather than mocking
around the exact things being tested.

## API Documentation

See [`docs/openapi.yaml`](docs/openapi.yaml).
