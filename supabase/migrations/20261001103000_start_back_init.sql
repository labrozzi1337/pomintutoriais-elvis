-- Isola os dados deste projeto em um schema próprio e mantém toda regra de negócio no backend.

create schema if not exists tutoriais;

revoke all on schema tutoriais from public, anon, authenticated;
grant usage on schema tutoriais to service_role;

create table if not exists tutoriais.app_metadata (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

alter table tutoriais.app_metadata enable row level security;

revoke all on table tutoriais.app_metadata from public, anon, authenticated;
grant select, insert, update, delete on table tutoriais.app_metadata to service_role;

alter default privileges in schema tutoriais revoke all on tables from public, anon, authenticated;
alter default privileges in schema tutoriais grant select, insert, update, delete on tables to service_role;

