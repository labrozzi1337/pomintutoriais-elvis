-- Persiste geração de voz e renderização da fase 3 no schema exclusivo da aplicação.

begin;
set local lock_timeout = '15s';

alter table tutoriais.vozes
  add column if not exists modelo text not null default 's2.1-pro-free',
  add column if not exists configuracao jsonb not null default '{}'::jsonb,
  add column if not exists atualizado_em timestamptz not null default now();

commit;

begin;
set local lock_timeout = '15s';

alter table tutoriais.narracoes
  add column if not exists modelo text not null default 's2.1-pro-free',
  add column if not exists configuracao jsonb not null default '{}'::jsonb,
  add column if not exists taxa_aceleracao numeric(6, 5),
  add column if not exists custo_creditos numeric,
  add column if not exists codigo_erro text,
  add column if not exists atualizado_em timestamptz not null default now();

create unique index if not exists narracoes_bloco_hash_idx
  on tutoriais.narracoes (bloco_id, hash_cache)
  where hash_cache is not null;

commit;

begin;
set local lock_timeout = '15s';

alter table tutoriais.processamentos
  add column if not exists configuracao jsonb not null default '{}'::jsonb;

alter table tutoriais.processamentos drop constraint if exists processamentos_status_check;
alter table tutoriais.processamentos add constraint processamentos_status_check check (status in (
  'recebido', 'processando_video', 'analisando', 'roteiro_pronto', 'gerando_voz',
  'validando_duracoes', 'ajuste_necessario', 'renderizando', 'verificando_resultado',
  'concluido', 'erro', 'cancelado'
));

commit;

begin;
set local lock_timeout = '15s';

-- Reserva primeiro as tabelas consultadas pela policy para impedir inversão de locks.
lock table tutoriais.projetos, tutoriais.roteiros, tutoriais.blocos in access share mode;
lock table tutoriais.narracoes in access exclusive mode;

grant select on tutoriais.vozes to authenticated;
grant select on tutoriais.narracoes to authenticated;

drop policy if exists narracoes_autorizadas on tutoriais.narracoes;
create policy narracoes_autorizadas on tutoriais.narracoes for select to authenticated using (
  exists (
    select 1
    from tutoriais.blocos bloco
    join tutoriais.roteiros roteiro on roteiro.id = bloco.roteiro_id
    join tutoriais.projetos projeto on projeto.id = roteiro.projeto_id
    where bloco.id = narracoes.bloco_id
  )
);

commit;
