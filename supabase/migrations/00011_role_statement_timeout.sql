-- 00011_role_statement_timeout.sql
-- #183 K2: bound any single statement so a stuck query releases its pooled
-- connection instead of holding it until the function maxDuration kill.
alter role authenticated set statement_timeout = '8s';
alter role anon          set statement_timeout = '8s';
alter role service_role  set statement_timeout = '8s';
