-- Publica automaticamente na Wiki os tutoriais concluídos e classificados.

begin;
set local lock_timeout = '15s';

create table if not exists tutoriais.wiki_artigos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null unique references tutoriais.projetos(id) on delete cascade,
  resumo text not null default '' check (char_length(resumo) <= 2000),
  conteudo text not null default '' check (char_length(conteudo) <= 30000),
  editado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table tutoriais.wiki_artigos enable row level security;
grant select, insert, update, delete on tutoriais.wiki_artigos to authenticated;

create policy wiki_leitura on tutoriais.wiki_artigos for select to authenticated
  using (tutoriais.usuario_autorizado());
create policy wiki_criacao on tutoriais.wiki_artigos for insert to authenticated
  with check (tutoriais.usuario_autorizado());
create policy wiki_edicao on tutoriais.wiki_artigos for update to authenticated
  using (tutoriais.usuario_autorizado()) with check (tutoriais.usuario_autorizado());
create policy wiki_exclusao on tutoriais.wiki_artigos for delete to authenticated
  using (tutoriais.usuario_admin());

create or replace function tutoriais.publicar_tutorial_na_wiki()
returns trigger
language plpgsql
security definer
set search_path = tutoriais
as $$
begin
  if new.status = 'concluido' and new.empresa_id is not null and new.area_id is not null then
    insert into tutoriais.wiki_artigos (projeto_id)
    values (new.id)
    on conflict (projeto_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists publicar_tutorial_na_wiki on tutoriais.projetos;
create trigger publicar_tutorial_na_wiki
after insert or update of status, empresa_id, area_id on tutoriais.projetos
for each row execute function tutoriais.publicar_tutorial_na_wiki();

insert into tutoriais.wiki_artigos (projeto_id)
select id from tutoriais.projetos
where status = 'concluido' and empresa_id is not null and area_id is not null
on conflict (projeto_id) do nothing;

commit;
