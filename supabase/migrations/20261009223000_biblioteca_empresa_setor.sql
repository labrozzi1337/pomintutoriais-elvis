-- Organiza a biblioteca em pastas lógicas por empresa e setor.

begin;
set local lock_timeout = '15s';

alter table tutoriais.projetos
  add column if not exists empresa text not null default 'Sem empresa',
  add column if not exists setor text not null default 'Geral';

alter table tutoriais.projetos drop constraint if exists projetos_empresa_check;
alter table tutoriais.projetos add constraint projetos_empresa_check
  check (char_length(empresa) between 1 and 120);

alter table tutoriais.projetos drop constraint if exists projetos_setor_check;
alter table tutoriais.projetos add constraint projetos_setor_check
  check (char_length(setor) between 1 and 120);

commit;

create index if not exists projetos_pastas_idx
  on tutoriais.projetos (proprietario_id, empresa, setor, criado_em desc);
