-- Autorização simples: usuários comuns editam tudo e administradores também podem excluir.

begin;
set local lock_timeout = '15s';

create table if not exists tutoriais.usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete set null,
  email text not null check (char_length(trim(email)) between 3 and 254),
  nome text check (nome is null or char_length(trim(nome)) between 1 and 120),
  tipo text not null default 'comum' check (tipo in ('comum', 'admin')),
  metodo text not null default 'local' check (metodo in ('local', 'microsoft')),
  status text not null default 'ativo' check (status in ('ativo', 'bloqueado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists usuarios_email_unico_idx on tutoriais.usuarios (lower(email));
alter table tutoriais.usuarios enable row level security;
grant select on tutoriais.usuarios to authenticated;
grant all on tutoriais.usuarios to service_role;

-- Preserva o acesso das contas que já usavam a aplicação antes deste controle.
insert into tutoriais.usuarios (auth_id, email, nome, tipo, metodo, status, criado_em, atualizado_em)
select auth_id, email, nome,
  case when row_number() over (order by criado_em, auth_id) = 1 then 'admin' else 'comum' end,
  metodo, 'ativo', criado_em, now()
from (
  select distinct on (lower(email)) id as auth_id, lower(email) as email,
    nullif(trim(raw_user_meta_data ->> 'name'), '') as nome,
    case when coalesce(raw_app_meta_data ->> 'provider', '') = 'azure' then 'microsoft' else 'local' end as metodo,
    created_at as criado_em
  from auth.users
  where email is not null
  order by lower(email), created_at
) existentes
on conflict do nothing;

create or replace function tutoriais.usuario_autorizado()
returns boolean language sql stable security definer set search_path = tutoriais as $$
  select exists (
    select 1 from tutoriais.usuarios
    where auth_id = auth.uid() and status = 'ativo'
  );
$$;

create or replace function tutoriais.usuario_admin()
returns boolean language sql stable security definer set search_path = tutoriais as $$
  select exists (
    select 1 from tutoriais.usuarios
    where auth_id = auth.uid() and status = 'ativo' and tipo = 'admin'
  );
$$;

revoke execute on function tutoriais.usuario_autorizado(), tutoriais.usuario_admin() from public;
grant execute on function tutoriais.usuario_autorizado(), tutoriais.usuario_admin() to authenticated;

-- Remove as regras antigas baseadas em propriedade; o acervo passa a ser compartilhado.
do $$
declare regra record;
begin
  for regra in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'tutoriais' and tablename in (
      'equipes', 'equipe_membros', 'projetos', 'arquivos', 'videos', 'roteiros', 'blocos',
      'roteiro_eventos', 'vozes', 'narracoes', 'processamentos', 'empresas', 'areas',
      'recordes_cobrinha', 'launcher_dispositivos', 'launcher_pareamentos', 'launcher_desafios', 'usuarios'
    )
  loop
    execute format('drop policy if exists %I on %I.%I', regra.policyname, regra.schemaname, regra.tablename);
  end loop;
end $$;

create policy usuarios_proprio_perfil on tutoriais.usuarios for select to authenticated
  using (auth_id = auth.uid() and status = 'ativo');

create policy equipes_leitura on tutoriais.equipes for select to authenticated using (tutoriais.usuario_autorizado());
create policy equipes_criacao on tutoriais.equipes for insert to authenticated with check (tutoriais.usuario_autorizado());
create policy equipes_edicao on tutoriais.equipes for update to authenticated using (tutoriais.usuario_autorizado()) with check (tutoriais.usuario_autorizado());
create policy equipes_exclusao on tutoriais.equipes for delete to authenticated using (tutoriais.usuario_admin());

create policy equipe_membros_leitura on tutoriais.equipe_membros for select to authenticated using (tutoriais.usuario_autorizado());
create policy equipe_membros_criacao on tutoriais.equipe_membros for insert to authenticated with check (tutoriais.usuario_autorizado());
create policy equipe_membros_edicao on tutoriais.equipe_membros for update to authenticated using (tutoriais.usuario_autorizado()) with check (tutoriais.usuario_autorizado());
create policy equipe_membros_exclusao on tutoriais.equipe_membros for delete to authenticated using (tutoriais.usuario_admin());

create policy projetos_leitura on tutoriais.projetos for select to authenticated using (tutoriais.usuario_autorizado());
create policy projetos_criacao on tutoriais.projetos for insert to authenticated with check (tutoriais.usuario_autorizado());
create policy projetos_edicao on tutoriais.projetos for update to authenticated using (tutoriais.usuario_autorizado()) with check (tutoriais.usuario_autorizado());
create policy projetos_exclusao on tutoriais.projetos for delete to authenticated using (tutoriais.usuario_admin());

create policy arquivos_leitura on tutoriais.arquivos for select to authenticated using (tutoriais.usuario_autorizado());
create policy arquivos_criacao on tutoriais.arquivos for insert to authenticated with check (tutoriais.usuario_autorizado());
create policy arquivos_edicao on tutoriais.arquivos for update to authenticated using (tutoriais.usuario_autorizado()) with check (tutoriais.usuario_autorizado());
create policy arquivos_exclusao_tecnica on tutoriais.arquivos for delete to authenticated using (tutoriais.usuario_autorizado());

create policy videos_leitura on tutoriais.videos for select to authenticated using (tutoriais.usuario_autorizado());
create policy videos_criacao on tutoriais.videos for insert to authenticated with check (tutoriais.usuario_autorizado());
create policy videos_edicao on tutoriais.videos for update to authenticated using (tutoriais.usuario_autorizado()) with check (tutoriais.usuario_autorizado());
create policy videos_exclusao_tecnica on tutoriais.videos for delete to authenticated using (tutoriais.usuario_autorizado());

create policy roteiros_leitura on tutoriais.roteiros for select to authenticated using (tutoriais.usuario_autorizado());
create policy roteiros_criacao on tutoriais.roteiros for insert to authenticated with check (tutoriais.usuario_autorizado());
create policy roteiros_edicao on tutoriais.roteiros for update to authenticated using (tutoriais.usuario_autorizado()) with check (tutoriais.usuario_autorizado());
create policy roteiros_exclusao_tecnica on tutoriais.roteiros for delete to authenticated using (tutoriais.usuario_autorizado());

create policy blocos_leitura on tutoriais.blocos for select to authenticated using (tutoriais.usuario_autorizado());
create policy blocos_criacao on tutoriais.blocos for insert to authenticated with check (tutoriais.usuario_autorizado());
create policy blocos_edicao on tutoriais.blocos for update to authenticated using (tutoriais.usuario_autorizado()) with check (tutoriais.usuario_autorizado());
create policy blocos_exclusao_tecnica on tutoriais.blocos for delete to authenticated using (tutoriais.usuario_autorizado());

create policy roteiro_eventos_leitura on tutoriais.roteiro_eventos for select to authenticated using (tutoriais.usuario_autorizado());
create policy roteiro_eventos_criacao on tutoriais.roteiro_eventos for insert to authenticated
  with check (tutoriais.usuario_autorizado() and usuario_id = auth.uid());

create policy vozes_leitura on tutoriais.vozes for select to authenticated using (tutoriais.usuario_autorizado() and ativa);
create policy narracoes_leitura on tutoriais.narracoes for select to authenticated using (tutoriais.usuario_autorizado());

create policy processamentos_leitura on tutoriais.processamentos for select to authenticated using (tutoriais.usuario_autorizado());
create policy processamentos_criacao on tutoriais.processamentos for insert to authenticated with check (tutoriais.usuario_autorizado());
create policy processamentos_edicao on tutoriais.processamentos for update to authenticated using (tutoriais.usuario_autorizado()) with check (tutoriais.usuario_autorizado());

create policy empresas_leitura on tutoriais.empresas for select to authenticated using (tutoriais.usuario_autorizado());
create policy empresas_criacao on tutoriais.empresas for insert to authenticated with check (tutoriais.usuario_autorizado());
create policy empresas_edicao on tutoriais.empresas for update to authenticated using (tutoriais.usuario_autorizado()) with check (tutoriais.usuario_autorizado());
create policy empresas_exclusao on tutoriais.empresas for delete to authenticated using (tutoriais.usuario_admin());

create policy areas_leitura on tutoriais.areas for select to authenticated using (tutoriais.usuario_autorizado());
create policy areas_criacao on tutoriais.areas for insert to authenticated with check (tutoriais.usuario_autorizado());
create policy areas_edicao on tutoriais.areas for update to authenticated using (tutoriais.usuario_autorizado()) with check (tutoriais.usuario_autorizado());
create policy areas_exclusao on tutoriais.areas for delete to authenticated using (tutoriais.usuario_admin());

create policy recordes_leitura on tutoriais.recordes_cobrinha for select to authenticated using (tutoriais.usuario_autorizado());
create policy recordes_criacao on tutoriais.recordes_cobrinha for insert to authenticated
  with check (tutoriais.usuario_autorizado() and proprietario_id = auth.uid());
create policy recordes_edicao on tutoriais.recordes_cobrinha for update to authenticated
  using (tutoriais.usuario_autorizado() and proprietario_id = auth.uid())
  with check (tutoriais.usuario_autorizado() and proprietario_id = auth.uid());

create policy launcher_dispositivos_leitura on tutoriais.launcher_dispositivos for select to authenticated
  using (tutoriais.usuario_autorizado() and proprietario_id = auth.uid());
create policy launcher_dispositivos_edicao on tutoriais.launcher_dispositivos for update to authenticated
  using (tutoriais.usuario_autorizado() and proprietario_id = auth.uid())
  with check (tutoriais.usuario_autorizado() and proprietario_id = auth.uid());
create policy launcher_pareamentos_leitura on tutoriais.launcher_pareamentos for select to authenticated
  using (tutoriais.usuario_autorizado() and proprietario_id = auth.uid());
create policy launcher_pareamentos_criacao on tutoriais.launcher_pareamentos for insert to authenticated
  with check (tutoriais.usuario_autorizado() and proprietario_id = auth.uid());
create policy launcher_desafios_leitura on tutoriais.launcher_desafios for select to authenticated
  using (tutoriais.usuario_autorizado() and proprietario_id = auth.uid());
create policy launcher_desafios_criacao on tutoriais.launcher_desafios for insert to authenticated
  with check (
    tutoriais.usuario_autorizado() and proprietario_id = auth.uid() and exists (
      select 1 from tutoriais.launcher_dispositivos dispositivo
      where dispositivo.id = dispositivo_id and dispositivo.proprietario_id = auth.uid() and dispositivo.ativo
    )
  );

commit;
