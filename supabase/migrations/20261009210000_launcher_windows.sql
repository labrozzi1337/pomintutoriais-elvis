-- Pareamento e confirmação do Launcher; executar manualmente no SQL Editor.
begin;
set local lock_timeout = '15s';

create table if not exists tutoriais.launcher_dispositivos (
  id uuid primary key default gen_random_uuid(),
  proprietario_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create table if not exists tutoriais.launcher_pareamentos (
  id uuid primary key default gen_random_uuid(),
  proprietario_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  expira_em timestamptz not null,
  consumido_em timestamptz,
  criado_em timestamptz not null default now()
);
create table if not exists tutoriais.launcher_desafios (
  id uuid primary key default gen_random_uuid(),
  proprietario_id uuid not null references auth.users(id) on delete cascade,
  dispositivo_id uuid not null references tutoriais.launcher_dispositivos(id) on delete cascade,
  sessao_hash text not null,
  status text not null default 'aguardando' check (status in ('aguardando', 'aberto', 'recordly_nao_encontrado', 'cancelado', 'erro')),
  expira_em timestamptz not null,
  respondido_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists launcher_dispositivos_proprietario_idx on tutoriais.launcher_dispositivos(proprietario_id, criado_em desc);
create index if not exists launcher_desafios_expiracao_idx on tutoriais.launcher_desafios(expira_em);
alter table tutoriais.launcher_dispositivos enable row level security;
alter table tutoriais.launcher_pareamentos enable row level security;
alter table tutoriais.launcher_desafios enable row level security;
grant select, update on tutoriais.launcher_dispositivos to authenticated;
grant select, insert on tutoriais.launcher_pareamentos, tutoriais.launcher_desafios to authenticated;
drop policy if exists launcher_dispositivos_proprios on tutoriais.launcher_dispositivos;
create policy launcher_dispositivos_proprios on tutoriais.launcher_dispositivos for select to authenticated using (proprietario_id = auth.uid());
drop policy if exists launcher_dispositivos_revogaveis on tutoriais.launcher_dispositivos;
create policy launcher_dispositivos_revogaveis on tutoriais.launcher_dispositivos for update to authenticated using (proprietario_id = auth.uid()) with check (proprietario_id = auth.uid());
drop policy if exists launcher_pareamentos_proprios on tutoriais.launcher_pareamentos;
create policy launcher_pareamentos_proprios on tutoriais.launcher_pareamentos for select to authenticated using (proprietario_id = auth.uid());
drop policy if exists launcher_pareamentos_criados on tutoriais.launcher_pareamentos;
create policy launcher_pareamentos_criados on tutoriais.launcher_pareamentos for insert to authenticated with check (proprietario_id = auth.uid());
drop policy if exists launcher_desafios_proprios on tutoriais.launcher_desafios;
create policy launcher_desafios_proprios on tutoriais.launcher_desafios for select to authenticated using (proprietario_id = auth.uid());
drop policy if exists launcher_desafios_criados on tutoriais.launcher_desafios;
create policy launcher_desafios_criados on tutoriais.launcher_desafios for insert to authenticated with check (
  proprietario_id = auth.uid() and exists (select 1 from tutoriais.launcher_dispositivos dispositivo where dispositivo.id = dispositivo_id and dispositivo.proprietario_id = auth.uid() and dispositivo.ativo)
);
commit;
