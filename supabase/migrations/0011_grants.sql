-- Base table grants. RLS policies (0008) control WHICH rows each role can
-- touch; these grants control whether the role can touch the table AT ALL.
-- Without both, every operation fails regardless of RLS policy correctness.

grant select, insert, update, delete on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

-- Also grant on sequences/future tables so this doesn't silently break
-- again the next time we add a table.
grant usage on schema public to service_role, authenticated, anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role, authenticated;
alter default privileges in schema public
  grant select on tables to anon;