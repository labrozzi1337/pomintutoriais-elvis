-- Amplia o modelo de roteiro e libera operações da fase 2 sem regras de negócio no banco.

begin;

-- Evita deixar a fase parcialmente instalada se houver concorrência durante o DDL.
set local lock_timeout = '15s';

alter table tutoriais.roteiros
  add column if not exists atualizado_em timestamptz not null default now(),
  add column if not exists criado_por uuid references auth.users(id) on delete set null,
  add column if not exists edicoes_humanas boolean not null default false;

alter table tutoriais.blocos
  add column if not exists evidencias_frame jsonb not null default '[]'::jsonb,
  add column if not exists editado_por_usuario boolean not null default false;

alter table tutoriais.processamentos drop constraint if exists processamentos_video_id_tipo_key;
create unique index if not exists processamentos_video_tipo_ativo_idx
  on tutoriais.processamentos (video_id, tipo)
  where status not in ('concluido', 'erro', 'cancelado');

create table if not exists tutoriais.roteiro_eventos (
  id uuid primary key default gen_random_uuid(),
  roteiro_id uuid not null references tutoriais.roteiros(id) on delete cascade,
  usuario_id uuid references auth.users(id) on delete set null,
  tipo text not null,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists roteiro_eventos_roteiro_idx on tutoriais.roteiro_eventos (roteiro_id, criado_em desc);
alter table tutoriais.roteiro_eventos enable row level security;
grant select, insert, update, delete on tutoriais.roteiros, tutoriais.blocos to authenticated;
grant select, insert on tutoriais.roteiro_eventos to authenticated;

drop policy if exists roteiros_autorizados on tutoriais.roteiros;
create policy roteiros_autorizados on tutoriais.roteiros for select to authenticated using (
  exists (select 1 from tutoriais.projetos projeto where projeto.id = roteiros.projeto_id)
);
drop policy if exists roteiros_editados_por_autorizado on tutoriais.roteiros;
create policy roteiros_editados_por_autorizado on tutoriais.roteiros for update to authenticated
  using (exists (select 1 from tutoriais.projetos projeto where projeto.id = roteiros.projeto_id))
  with check (exists (select 1 from tutoriais.projetos projeto where projeto.id = roteiros.projeto_id));

drop policy if exists blocos_autorizados on tutoriais.blocos;
create policy blocos_autorizados on tutoriais.blocos for select to authenticated using (
  exists (select 1 from tutoriais.roteiros roteiro join tutoriais.projetos projeto on projeto.id = roteiro.projeto_id where roteiro.id = blocos.roteiro_id)
);
drop policy if exists blocos_criados_por_autorizado on tutoriais.blocos;
create policy blocos_criados_por_autorizado on tutoriais.blocos for insert to authenticated with check (
  exists (select 1 from tutoriais.roteiros roteiro join tutoriais.projetos projeto on projeto.id = roteiro.projeto_id where roteiro.id = blocos.roteiro_id)
);
drop policy if exists blocos_editados_por_autorizado on tutoriais.blocos;
create policy blocos_editados_por_autorizado on tutoriais.blocos for update to authenticated
  using (exists (select 1 from tutoriais.roteiros roteiro join tutoriais.projetos projeto on projeto.id = roteiro.projeto_id where roteiro.id = blocos.roteiro_id))
  with check (exists (select 1 from tutoriais.roteiros roteiro join tutoriais.projetos projeto on projeto.id = roteiro.projeto_id where roteiro.id = blocos.roteiro_id));
drop policy if exists blocos_excluidos_por_autorizado on tutoriais.blocos;
create policy blocos_excluidos_por_autorizado on tutoriais.blocos for delete to authenticated using (
  exists (select 1 from tutoriais.roteiros roteiro join tutoriais.projetos projeto on projeto.id = roteiro.projeto_id where roteiro.id = blocos.roteiro_id)
);

drop policy if exists roteiro_eventos_autorizados on tutoriais.roteiro_eventos;
create policy roteiro_eventos_autorizados on tutoriais.roteiro_eventos for select to authenticated using (
  exists (select 1 from tutoriais.roteiros roteiro join tutoriais.projetos projeto on projeto.id = roteiro.projeto_id where roteiro.id = roteiro_eventos.roteiro_id)
);
drop policy if exists roteiro_eventos_criados_pelo_usuario on tutoriais.roteiro_eventos;
create policy roteiro_eventos_criados_pelo_usuario on tutoriais.roteiro_eventos for insert to authenticated with check (
  usuario_id = auth.uid() and exists (
    select 1 from tutoriais.roteiros roteiro join tutoriais.projetos projeto on projeto.id = roteiro.projeto_id
    where roteiro.id = roteiro_eventos.roteiro_id
  )
);

commit;
