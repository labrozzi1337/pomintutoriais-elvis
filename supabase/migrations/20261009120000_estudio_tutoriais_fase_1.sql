-- Cria a base aditiva do Estúdio; regras de negócio permanecem na API e no worker.

create table tutoriais.equipes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 120),
  proprietario_id uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table tutoriais.equipe_membros (
  equipe_id uuid not null references tutoriais.equipes(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  papel text not null check (papel in ('proprietario', 'editor', 'leitor')),
  criado_em timestamptz not null default now(),
  primary key (equipe_id, usuario_id)
);

create table tutoriais.projetos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 160),
  proprietario_id uuid not null references auth.users(id) on delete cascade,
  equipe_id uuid references tutoriais.equipes(id) on delete set null,
  status text not null default 'recebido' check (status in (
    'recebido', 'processando_video', 'analisando', 'roteiro_pronto',
    'gerando_voz', 'renderizando', 'concluido', 'erro', 'cancelado'
  )),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table tutoriais.arquivos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references tutoriais.projetos(id) on delete cascade,
  tipo text not null check (tipo in ('video_original', 'temporario', 'thumbnail', 'audio', 'video_final', 'legenda')),
  chave_armazenamento text not null unique,
  mime_type text not null,
  tamanho_bytes bigint not null check (tamanho_bytes >= 0),
  hash_sha256 text,
  criado_em timestamptz not null default now(),
  excluir_apos timestamptz
);

create table tutoriais.videos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references tutoriais.projetos(id) on delete cascade,
  arquivo_original_id uuid not null references tutoriais.arquivos(id) on delete restrict,
  nome_original text not null,
  mime_type text not null,
  tamanho_bytes bigint not null check (tamanho_bytes > 0),
  duracao_ms integer check (duracao_ms > 0),
  largura integer check (largura > 0),
  altura integer check (altura > 0),
  fps numeric(10, 4) check (fps > 0),
  possui_audio boolean,
  status text not null default 'recebido' check (status in ('recebido', 'processando_video', 'pronto', 'erro', 'cancelado')),
  codigo_erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table tutoriais.roteiros (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references tutoriais.projetos(id) on delete cascade,
  versao integer not null check (versao > 0),
  status text not null default 'rascunho' check (status in ('rascunho', 'pronto', 'substituido')),
  modelo text,
  prompt_versao text,
  uso_provedor jsonb,
  criado_em timestamptz not null default now(),
  unique (projeto_id, versao)
);

create table tutoriais.blocos (
  id uuid primary key default gen_random_uuid(),
  roteiro_id uuid not null references tutoriais.roteiros(id) on delete cascade,
  ordem integer not null check (ordem >= 0),
  inicio_ms integer not null check (inicio_ms >= 0),
  fim_ms integer not null check (fim_ms > inicio_ms),
  acao_visual text not null default '',
  narracao text not null default '',
  confianca numeric(5, 4) check (confianca between 0 and 1),
  status text not null default 'rascunho',
  versao integer not null default 1 check (versao > 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (roteiro_id, ordem)
);

create table tutoriais.vozes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  provedor text not null default 'fish',
  referencia_externa text not null,
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (provedor, referencia_externa)
);

create table tutoriais.narracoes (
  id uuid primary key default gen_random_uuid(),
  bloco_id uuid not null references tutoriais.blocos(id) on delete cascade,
  voz_id uuid not null references tutoriais.vozes(id) on delete restrict,
  arquivo_id uuid references tutoriais.arquivos(id) on delete set null,
  hash_cache text,
  duracao_ms integer check (duracao_ms > 0),
  status text not null default 'pendente',
  tentativas integer not null default 0 check (tentativas >= 0),
  criado_em timestamptz not null default now()
);

create table tutoriais.processamentos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references tutoriais.projetos(id) on delete cascade,
  video_id uuid references tutoriais.videos(id) on delete cascade,
  tipo text not null,
  status text not null check (status in (
    'recebido', 'processando_video', 'analisando', 'roteiro_pronto',
    'gerando_voz', 'renderizando', 'concluido', 'erro', 'cancelado'
  )),
  progresso integer not null default 0 check (progresso between 0 and 100),
  mensagem text,
  job_id text,
  tentativas integer not null default 0 check (tentativas >= 0),
  codigo_erro text,
  cancelamento_solicitado_em timestamptz,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (video_id, tipo)
);

create index projetos_proprietario_idx on tutoriais.projetos (proprietario_id, criado_em desc);
create index projetos_equipe_idx on tutoriais.projetos (equipe_id) where equipe_id is not null;
create index arquivos_projeto_idx on tutoriais.arquivos (projeto_id);
create index videos_projeto_idx on tutoriais.videos (projeto_id, criado_em desc);
create index roteiros_projeto_idx on tutoriais.roteiros (projeto_id, versao desc);
create index blocos_roteiro_idx on tutoriais.blocos (roteiro_id, ordem);
create index processamentos_projeto_idx on tutoriais.processamentos (projeto_id, criado_em desc);

alter table tutoriais.equipes enable row level security;
alter table tutoriais.equipe_membros enable row level security;
alter table tutoriais.projetos enable row level security;
alter table tutoriais.arquivos enable row level security;
alter table tutoriais.videos enable row level security;
alter table tutoriais.roteiros enable row level security;
alter table tutoriais.blocos enable row level security;
alter table tutoriais.vozes enable row level security;
alter table tutoriais.narracoes enable row level security;
alter table tutoriais.processamentos enable row level security;

grant usage on schema tutoriais to authenticated;
grant select, insert, update, delete on tutoriais.equipes, tutoriais.equipe_membros,
  tutoriais.projetos, tutoriais.arquivos, tutoriais.videos, tutoriais.roteiros,
  tutoriais.blocos, tutoriais.narracoes, tutoriais.processamentos to authenticated;
grant select on tutoriais.vozes to authenticated;

create policy equipes_do_proprietario on tutoriais.equipes for select to authenticated
  using (proprietario_id = auth.uid());
create policy equipes_criadas_pelo_usuario on tutoriais.equipes for insert to authenticated
  with check (proprietario_id = auth.uid());
create policy equipes_atualizadas_pelo_proprietario on tutoriais.equipes for update to authenticated
  using (proprietario_id = auth.uid()) with check (proprietario_id = auth.uid());
create policy equipes_excluidas_pelo_proprietario on tutoriais.equipes for delete to authenticated
  using (proprietario_id = auth.uid());

create policy membro_visivel_pelo_usuario on tutoriais.equipe_membros for select to authenticated
  using (usuario_id = auth.uid());
create policy membros_geridos_pelo_proprietario on tutoriais.equipe_membros for insert to authenticated with check (
  exists (select 1 from tutoriais.equipes equipe where equipe.id = equipe_id and equipe.proprietario_id = auth.uid())
);
create policy membros_removidos_pelo_proprietario on tutoriais.equipe_membros for delete to authenticated using (
  exists (select 1 from tutoriais.equipes equipe where equipe.id = equipe_id and equipe.proprietario_id = auth.uid())
);

create policy projetos_autorizados on tutoriais.projetos for select to authenticated using (
  proprietario_id = auth.uid() or exists (
    select 1 from tutoriais.equipe_membros membro
    where membro.equipe_id = projetos.equipe_id and membro.usuario_id = auth.uid()
  )
);
create policy projetos_criados_pelo_usuario on tutoriais.projetos for insert to authenticated with check (
  proprietario_id = auth.uid() and (
    equipe_id is null or exists (
      select 1 from tutoriais.equipe_membros membro
      where membro.equipe_id = projetos.equipe_id and membro.usuario_id = auth.uid()
        and membro.papel in ('proprietario', 'editor')
    )
  )
);
create policy projetos_atualizados_pelo_proprietario on tutoriais.projetos for update to authenticated
  using (proprietario_id = auth.uid()) with check (proprietario_id = auth.uid());
create policy projetos_excluidos_pelo_proprietario on tutoriais.projetos for delete to authenticated
  using (proprietario_id = auth.uid());

create policy arquivos_autorizados on tutoriais.arquivos for select to authenticated using (
  exists (select 1 from tutoriais.projetos projeto where projeto.id = arquivos.projeto_id)
);
create policy arquivos_criados_em_projeto_autorizado on tutoriais.arquivos for insert to authenticated with check (
  exists (
    select 1 from tutoriais.projetos projeto
    where projeto.id = arquivos.projeto_id and (
      projeto.proprietario_id = auth.uid() or exists (
        select 1 from tutoriais.equipe_membros membro
        where membro.equipe_id = projeto.equipe_id and membro.usuario_id = auth.uid()
          and membro.papel in ('proprietario', 'editor')
      )
    )
  )
);
create policy arquivos_excluidos_em_projeto_autorizado on tutoriais.arquivos for delete to authenticated using (
  exists (
    select 1 from tutoriais.projetos projeto
    where projeto.id = arquivos.projeto_id and (
      projeto.proprietario_id = auth.uid() or exists (
        select 1 from tutoriais.equipe_membros membro
        where membro.equipe_id = projeto.equipe_id and membro.usuario_id = auth.uid()
          and membro.papel in ('proprietario', 'editor')
      )
    )
  )
);

create policy videos_autorizados on tutoriais.videos for select to authenticated using (
  exists (select 1 from tutoriais.projetos projeto where projeto.id = videos.projeto_id)
);
create policy videos_criados_em_projeto_autorizado on tutoriais.videos for insert to authenticated with check (
  exists (
    select 1 from tutoriais.projetos projeto
    where projeto.id = videos.projeto_id and (
      projeto.proprietario_id = auth.uid() or exists (
        select 1 from tutoriais.equipe_membros membro
        where membro.equipe_id = projeto.equipe_id and membro.usuario_id = auth.uid()
          and membro.papel in ('proprietario', 'editor')
      )
    )
  )
);
create policy videos_atualizados_em_projeto_autorizado on tutoriais.videos for update to authenticated using (
  exists (
    select 1 from tutoriais.projetos projeto
    where projeto.id = videos.projeto_id and (
      projeto.proprietario_id = auth.uid() or exists (
        select 1 from tutoriais.equipe_membros membro
        where membro.equipe_id = projeto.equipe_id and membro.usuario_id = auth.uid()
          and membro.papel in ('proprietario', 'editor')
      )
    )
  )
);

create policy processamentos_autorizados on tutoriais.processamentos for select to authenticated using (
  exists (select 1 from tutoriais.projetos projeto where projeto.id = processamentos.projeto_id)
);
create policy processamentos_criados_em_projeto_autorizado on tutoriais.processamentos for insert to authenticated with check (
  exists (
    select 1 from tutoriais.projetos projeto
    where projeto.id = processamentos.projeto_id and (
      projeto.proprietario_id = auth.uid() or exists (
        select 1 from tutoriais.equipe_membros membro
        where membro.equipe_id = projeto.equipe_id and membro.usuario_id = auth.uid()
          and membro.papel in ('proprietario', 'editor')
      )
    )
  )
);
create policy processamentos_atualizados_em_projeto_autorizado on tutoriais.processamentos for update to authenticated using (
  exists (
    select 1 from tutoriais.projetos projeto
    where projeto.id = processamentos.projeto_id and (
      projeto.proprietario_id = auth.uid() or exists (
        select 1 from tutoriais.equipe_membros membro
        where membro.equipe_id = projeto.equipe_id and membro.usuario_id = auth.uid()
          and membro.papel in ('proprietario', 'editor')
      )
    )
  )
);

create policy vozes_ativas on tutoriais.vozes for select to authenticated using (ativa);

-- Roteiros, blocos e narrações recebem policies quando suas operações forem expostas nas fases 2 e 3.
