# Arquitetura do Estúdio de Tutoriais IA

## Estado verificado

O repositório continua como monorepo npm: React 18 + Vite no frontend, Next.js 16 App Router na API e Supabase/PostgreSQL no schema `tutoriais`. A fase 1 adiciona autenticação, upload e processamento inicial sem alterar as telas anteriores do hub.

As fases 2/3 acrescentaram Responses API/OpenAI, clips Fish cacheados, render FFmpeg e artefatos WAV/MP4/SRT/VTT. O editor revisa tempos/textos, divide/une cenas e recupera snapshots. O botão do Windows usa um protocolo local que aponta diretamente para o Recordly já instalado, sem launcher ou pareamento. Exportar MP4 do Recordly e importar manualmente continua sendo o fluxo base.

## Decisão de implantação

```text
Navegador
  ├─ Supabase Auth (login; chave pública)
  └─ nginx / Vite
       └─ /api/v1/* → Next.js API
                         ├─ Supabase com JWT do usuário + RLS
                         ├─ volume estudio-arquivos
                         └─ Redis / BullMQ → worker + FFprobe
                                              └─ mesmo volume
```

- `compose.yaml` sobe `frontend`, `api`, `worker` e `redis`. O PostgreSQL/Supabase existente não é duplicado.
- API e worker compartilham somente o volume de arquivos. O banco guarda chaves, nunca bytes de vídeo.
- `ArmazenamentoArquivos` isola a implementação local; uma futura implantação distribuída pode substituí-la por S3/MinIO.
- O worker recebe apenas `processamentoId`. Ele reidrata projeto, vídeo e chave pelo banco antes de usar a credencial interna.

## Autenticação e autorização

O frontend usa somente URL e chave pública do Supabase. Cada chamada protegida envia o access token no header `Authorization`. A API valida o token por `auth.getUser()` e consulta o schema com o mesmo JWT; as policies RLS isolam projetos pessoais, comprovado por teste real A/B. Antes de liberar equipes, ainda é necessário endurecer/testar escrita de leitor/editor nas policies da fase 2.

A service role permanece em operações internas: worker, resolução de arquivo já autorizado por cookie assinado, voz padrão de ambiente e health check. O worker não aceita caminho, comando ou credencial do job e confere vínculos projeto/vídeo/arquivo e prefixo normalizado do storage. Downloads e reproduções recebem um HMAC de cinco minutos vinculado ao ID do vídeo/artefato e modo de acesso; trocar o ID invalida a assinatura. O HMAC fica em cookie `HttpOnly` restrito ao caminho do arquivo, não em URL ou log.

## Upload e processamento

1. `POST /api/v1/projetos` cria o projeto.
2. `POST /api/v1/projetos/{id}/uploads` valida nome, MIME declarado e limite de 500 MB por padrão.
3. `PUT /api/v1/projetos/{id}/uploads/{uploadId}` grava partes sequenciais de 5 MB por streaming. O nome externo nunca vira caminho.
4. `POST .../conclusao` confere quantidade de bytes e assinatura `ftyp`, calcula SHA-256, persiste metadados e agenda um job idempotente.
5. O worker executa `ffprobe` por `spawn` com argumentos fixos, confirma contêiner, vídeo, dimensões, FPS e duração máxima de 15 minutos.
6. O estado fica persistido em `processamentos`, permitindo polling e cancelamento após refresh.

## Persistência

A migration `20261009120000_estudio_tutoriais_fase_1.sql` cria `equipes`, `equipe_membros`, `projetos`, `arquivos`, `videos`, `roteiros`, `blocos`, `vozes`, `narracoes` e `processamentos`, com constraints, índices e RLS. Não há funções, triggers ou RPCs. `updated_at`/`atualizado_em` é responsabilidade explícita da aplicação.

A migration aditiva `20261009223000_biblioteca_empresa_setor.sql` acrescenta `empresa` e `setor` aos projetos. A árvore de pastas e a busca são projeções desses metadados; não existem diretórios físicos ou cópias adicionais dos vídeos.

O rollback está em `supabase/rollbacks/20261009120000_estudio_tutoriais_fase_1_down.sql`; ele é destrutivo e exige backup/aceite manual. A migration de subida não remove nem altera dados existentes.

## Estados da fase

Projetos e processamentos usam a sequência global `recebido`, `processando_video`, `analisando`, `roteiro_pronto`, `gerando_voz`, `validando_duracoes`, `renderizando`, `verificando_resultado`, `concluido`, `erro`, `cancelado`. A análise pode persistir a configuração de narração e enfileirar automaticamente o segundo job após criar o roteiro; o navegador apenas acompanha os estados. Vídeos usam `recebido`, `processando_video`, `pronto`, `erro`, `cancelado`.

## Limites atuais e próximas fases

- Uploads são sequenciais e recuperáveis no mesmo host; upload paralelo/multipart S3 só é necessário em implantação distribuída.
- Retenção automática, quotas e limpeza de órfãos pertencem ao hardening da fase 6.
- Roteiros e narrações possuem endpoints reais. Escritas da timeline usam lock Redis, versão otimista e compensação/snapshot; não há transação multirregistro via Data API nem edição colaborativa validada.
