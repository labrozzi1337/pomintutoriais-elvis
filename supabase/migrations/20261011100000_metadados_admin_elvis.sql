-- Amplia os metadados editáveis e garante o administrador inicial solicitado.

begin;
set local lock_timeout = '15s';

alter table tutoriais.projetos
  add column if not exists descricao text not null default '',
  add column if not exists tags text[] not null default '{}';

alter table tutoriais.projetos drop constraint if exists projetos_descricao_check;
alter table tutoriais.projetos add constraint projetos_descricao_check
  check (char_length(descricao) <= 2000);
alter table tutoriais.projetos drop constraint if exists projetos_tags_check;
alter table tutoriais.projetos add constraint projetos_tags_check
  check (cardinality(tags) <= 20);

insert into tutoriais.usuarios (email, tipo, metodo, status)
select 'elvis@labrozzi.com.br', 'admin', 'local', 'ativo'
where not exists (
  select 1 from tutoriais.usuarios where lower(email) = 'elvis@labrozzi.com.br'
);

update tutoriais.usuarios perfil set
  auth_id = coalesce(perfil.auth_id, identidade.id),
  nome = coalesce(perfil.nome, nullif(trim(identidade.raw_user_meta_data ->> 'name'), '')),
  metodo = case when coalesce(identidade.raw_app_meta_data ->> 'provider', '') = 'azure' then 'microsoft' else perfil.metodo end,
  tipo = 'admin',
  status = 'ativo',
  atualizado_em = now()
from auth.users identidade
where lower(perfil.email) = 'elvis@labrozzi.com.br'
  and lower(identidade.email) = 'elvis@labrozzi.com.br';

update tutoriais.usuarios set tipo = 'admin', status = 'ativo', atualizado_em = now()
where lower(email) = 'elvis@labrozzi.com.br';

commit;
