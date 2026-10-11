-- Separa os cadastros usados na criação e persiste o melhor placar por conta.

begin;
set local lock_timeout = '15s';

create table if not exists tutoriais.empresas (
  id uuid primary key default gen_random_uuid(),
  proprietario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  criado_em timestamptz not null default now(),
  unique (proprietario_id, nome)
);

create table if not exists tutoriais.areas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references tutoriais.empresas(id) on delete cascade,
  proprietario_id uuid not null references auth.users(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) between 1 and 120),
  criado_em timestamptz not null default now(),
  unique (empresa_id, nome)
);

create table if not exists tutoriais.recordes_cobrinha (
  proprietario_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(trim(nickname)) between 1 and 10),
  score integer not null check (score >= 0),
  atualizado_em timestamptz not null default now()
);

alter table tutoriais.projetos
  add column if not exists empresa_id uuid references tutoriais.empresas(id) on delete restrict,
  add column if not exists area_id uuid references tutoriais.areas(id) on delete restrict;

insert into tutoriais.empresas (proprietario_id, nome)
select proprietario_id, min(coalesce(nullif(trim(empresa), ''), 'Sem empresa'))
from tutoriais.projetos
group by proprietario_id, lower(coalesce(nullif(trim(empresa), ''), 'Sem empresa'))
on conflict (proprietario_id, nome) do nothing;

insert into tutoriais.areas (empresa_id, proprietario_id, nome)
select empresa.id, projeto.proprietario_id, min(coalesce(nullif(trim(projeto.setor), ''), 'Geral'))
from tutoriais.projetos projeto
join tutoriais.empresas empresa on empresa.proprietario_id = projeto.proprietario_id
  and lower(empresa.nome) = lower(coalesce(nullif(trim(projeto.empresa), ''), 'Sem empresa'))
group by empresa.id, projeto.proprietario_id, lower(coalesce(nullif(trim(projeto.setor), ''), 'Geral'))
on conflict (empresa_id, nome) do nothing;

update tutoriais.projetos projeto set
  empresa_id = empresa.id,
  area_id = area.id
from tutoriais.empresas empresa
join tutoriais.areas area on area.empresa_id = empresa.id
where empresa.proprietario_id = projeto.proprietario_id
  and lower(empresa.nome) = lower(coalesce(nullif(trim(projeto.empresa), ''), 'Sem empresa'))
  and lower(area.nome) = lower(coalesce(nullif(trim(projeto.setor), ''), 'Geral'))
  and projeto.empresa_id is null;

alter table tutoriais.empresas enable row level security;
alter table tutoriais.areas enable row level security;
alter table tutoriais.recordes_cobrinha enable row level security;

grant select, insert, update, delete on tutoriais.empresas, tutoriais.areas to authenticated;
grant select, insert, update on tutoriais.recordes_cobrinha to authenticated;

create policy empresas_do_usuario on tutoriais.empresas for all to authenticated
  using (proprietario_id = auth.uid()) with check (proprietario_id = auth.uid());
create policy areas_do_usuario on tutoriais.areas for all to authenticated
  using (proprietario_id = auth.uid()) with check (
    proprietario_id = auth.uid() and exists (
      select 1 from tutoriais.empresas empresa where empresa.id = empresa_id and empresa.proprietario_id = auth.uid()
    )
  );
create policy recordes_visiveis on tutoriais.recordes_cobrinha for select to authenticated using (true);
create policy recorde_criado_pelo_usuario on tutoriais.recordes_cobrinha for insert to authenticated
  with check (proprietario_id = auth.uid());
create policy recorde_atualizado_pelo_usuario on tutoriais.recordes_cobrinha for update to authenticated
  using (proprietario_id = auth.uid()) with check (proprietario_id = auth.uid());

create index if not exists areas_empresa_idx on tutoriais.areas (empresa_id, nome);
create unique index if not exists empresas_nome_unico_idx on tutoriais.empresas (proprietario_id, lower(nome));
create unique index if not exists areas_nome_unico_idx on tutoriais.areas (empresa_id, lower(nome));
create index if not exists recordes_cobrinha_score_idx on tutoriais.recordes_cobrinha (score desc, atualizado_em);

commit;
