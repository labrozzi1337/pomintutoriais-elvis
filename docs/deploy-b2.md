# Vercel e Backblaze B2

O armazenamento remoto usa o bucket privado configurado e o prefixo fixo
`POMIN-TUTORIAIS/`. As chaves relativas do banco não mudam:
`projetos/<id>/originais`, `projetos/<id>/thumbnails` e
`projetos/<id>/roteiros/...`. Manifestos de upload ficam em `.uploads/` dentro
do mesmo prefixo. Não torne o bucket público.

## Variáveis no backend da Vercel e no worker

Cadastre `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `B2_ENDPOINT` e
`B2_REGION` com os valores do `.env`. O `.env` local não é enviado pelo Git.
Não use prefixo `VITE_` nessas credenciais. `B2_BUCKET_ID` não é necessário
para a API S3. Mantenha também as variáveis privadas existentes de Supabase,
download, Redis e provedores de IA.

Para este domínio, `START_BACK_ALLOWED_ORIGINS` precisa conter
`https://pomintutoriais-elvis.vercel.app`. No Supabase Auth, autorize o retorno
`https://pomintutoriais-elvis.vercel.app/entrar`.

O CORS do bucket deve permitir GET, HEAD e PUT para as origens exatas do app,
com os headers de upload e Range. Preserve regras de outros aplicativos que
usem o mesmo bucket. A origem de produção e localhost:8081 foram adicionadas
na migração inicial.

## Upload e reprodução

A API autoriza o usuário pelo Supabase/RLS antes de emitir URLs temporárias.
O navegador envia partes diretamente à B2. A conclusão confere os tamanhos,
a assinatura MP4 e calcula SHA-256 antes de registrar e enfileirar o vídeo.
Downloads e reprodução usam URLs de cinco minutos, emitidas após autorização.
As capas automáticas continuam sendo extraídas do vídeo no navegador; capas
personalizadas são salvas na B2. Em Vercel, a ausência de configuração B2
gera erro explícito, sem tentar gravar mídia no filesystem da função.

## Migração repetível

Da raiz do repositório:

```powershell
node --env-file=.env --import tsx apps/backend/src/scripts/migrar-b2.ts apps/backend/data/estudio artifacts/b2-migration/docker
```

O script inventaria os arquivos de mídia em `projetos/`, compara hashes entre
origens, envia sem apagar os originais e verifica tamanho e metadado SHA-256
de cada objeto. Objetos remotos diferentes não são sobrescritos. Uploads
incompletos e arquivos temporários não entram na migração.

## Processamento na Vercel

Com `VERCEL=1`, a API usa Workflow em vez de Redis. Cada validação, análise
ou narração roda em um Sandbox privado com FFmpeg/FFprobe. O build empacota
`src/sandbox-worker.ts` em `dist/sandbox-worker.cjs`, incluído nas funções.
As rotas `/.well-known/workflow/*` precisam apontar para o backend.

O Sandbox recebe apenas as configurações necessárias ao processador, baixa
os arquivos da B2 e publica os resultados antes de concluir o banco. Não
expõe portas e não cria snapshots persistentes. O Workflow acompanha a
execução, registra falhas e encerra a máquina. Um lock por processamento
impede repetir o comando em reentregas do passo. A narração automática usa
um novo Sandbox após a análise. OIDC da Vercel autentica essas operações;
não cadastre tokens pessoais da Vercel no projeto.

No Hobby, o código limita cada etapa a 44 minutos. Esgotar as cotas da
Vercel ou os créditos OpenAI/Fish pode interromper novos trabalhos. Não há
upgrade automático nem contratação de plano. A API continua autenticando
usuários e aplicando RLS antes de agendar qualquer trabalho.

Localmente, `src/worker.ts` continua usando BullMQ/Redis e FFmpeg instalado.
O Compose repassa as variáveis B2 para API e worker. O health check verifica
o banco e a B2; na Vercel informa Redis como `not_required`, mas não é uma
garantia de saldo/quota disponível nos provedores.
