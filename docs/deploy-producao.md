# Deploy single-host — preparação, não publicação concluída

A instalação atual é Docker **local**. O deploy externo depende de servidor, domínio, DNS, credenciais autorizadas e fechamento das pendências de `testes-e-aceite.md`. Não exponha esta instalação na internet antes disso.

## Topologia

Caddy termina HTTPS → nginx/frontend → Next.js API → Supabase `tutoriais`. Redis e worker FFmpeg ficam internos; API/worker compartilham o volume persistente `estudio-arquivos`. Somente Caddy publica portas em produção.

`compose.producao.yaml` remove a porta local do frontend usando `!reset`. Use Docker Compose com suporte a essa tag e valide antes de subir. A configuração de HTTPS segue a [documentação oficial do Caddy](https://caddyserver.com/docs/quick-starts/reverse-proxy). O Caddy mantém certificados em volumes persistentes; não habilitamos logs de acesso com URLs/cookies/dados pessoais.

## Preparar o servidor

1. Use um servidor Linux com Docker/Compose, disco persistente suficiente e backup externo criptografado. Este arquivo não provisiona servidor nem DNS.
2. Aponte o domínio escolhido para o servidor; libere TCP 80/443 e, se desejado, UDP 443. Não publique Redis, API ou volumes.
3. Configure `.env` com chaves de servidor e valores públicos `VITE_SUPABASE_*`. Restrinja acesso ao arquivo. Nunca copie segredos para build args ou repositório.
4. Defina `START_BACK_DOMAIN`, `START_BACK_TLS_EMAIL` e `START_BACK_ALLOWED_ORIGINS=https://SEU_DOMINIO` — sem barra final e sem wildcard. Localhost não pertence à lista de produção.
5. Configure a URL do site e redirects permitidos no Supabase Auth para o domínio real.
6. Gere o pacote de associação do Recordly em uma estação Windows confiável se quiser incluí-lo no build; planeje assinatura digital antes de distribuir externamente.
7. Revise elegibilidade/termos da Fish e o modelo configurado. `s2.1-pro` pode ser configurado via `START_BACK_FISH_MODEL`; não suponha que a modalidade gratuita é permitida em produção. Não existem preços fictícios no código.

Comandos no servidor, depois do aceite:

```sh
docker compose -f compose.yaml -f compose.producao.yaml config --quiet
docker compose -f compose.yaml -f compose.producao.yaml up -d --build
docker compose -f compose.yaml -f compose.producao.yaml ps
curl --fail https://SEU_DOMINIO/api/v1/health
```

Não rode `config` sem `--quiet` em saída pública: ele pode mostrar variáveis de ambiente. Fixe versões/digests das imagens verificadas no processo de release; não faça atualização automática sem repetir testes.

## Proteções já implementadas

- RLS e JWT nas rotas, isolamento entre usuários comprovado por teste real; sem functions/triggers/RPCs próprios.
- Downloads por cookie HttpOnly de cinco minutos, escopado ao arquivo; cookies Secure em HTTPS. CORS restrito, CSP, anti-frame, `nosniff`, política de permissões e cache privado.
- Rate limit nginx por IP, 15 requisições/s com burst de 60 e resposta 429. Não substitui quotas/limites de custo por usuário; clientes atrás de proxy podem compartilhar o limite.
- Upload por partes, limite de tamanho/duração, assinatura MP4 e FFprobe; chaves de armazenamento não usam o nome enviado.
- Worker/API sem root; execução FFmpeg com argumentos controlados, cancelamento e timeout de render de 30 minutos.
- Análise/voz sem retry automático do job inteiro; retry limitado dos provedores, cache por texto/voz/modelo e confirmação de custos exigida na API.
- Lock Redis nas edições, controle de versão e snapshot/compensação. Não é transação multirregistro; não habilite edição colaborativa até validar falhas/reconexão.
- Logs de erro descartam paths/detalhes de provedor e correlacionam IDs; uso de tokens é persistido quando fornecido pela OpenAI.

## Backup e recuperação

Faça backup do **Supabase e dos volumes de arquivos/Redis no mesmo ponto consistente**, nunca apenas das migrations. Defina retenção e ensaie a restauração antes da publicação.

Procedimento manual recomendado:

1. Pause novos uploads e pare API/frontend/worker em janela de manutenção. Não use `down -v`.
2. Identifique os nomes exatos dos volumes com `docker volume ls`; não adivinhe nomes nem monte diretórios amplos.
3. Com os serviços parados, exporte `estudio-arquivos` e `redis-data` para arquivos de backup fora dos volumes. Armazene-os criptografados com acesso restrito. Salve também configuração de release e, em cofre separado, os secrets necessários.
4. Execute o procedimento de backup/snapshot do projeto Supabase disponível ao administrador; migrations não contêm os dados. Inclua Auth e esquema `tutoriais` na estratégia.
5. Reinicie os serviços. Registre data, hashes dos arquivos e ponto de banco correspondente sem PII.
6. Restaure primeiro em ambiente isolado: volumes novos, banco separado, chaves próprias e provedores pagos desabilitados. Não sobrescreva volumes/banco de produção para testar.
7. Confirme login, RLS A/B, leitura do roteiro, MP3, MP4 e duração, depois libere a recuperação real com aprovação.

Os backups podem conter gravações, textos e dados pessoais. O responsável deve definir base legal, acesso, exclusão, retenção e contatos da política de privacidade/LGPD. O aviso de consentimento da interface não substitui essa política.

## Bloqueadores da publicação

Ainda faltam quotas efetivas de disco/custo por usuário/projeto, limites por usuário (além do worker/rate limit global), expurgo configurável e remoção de órfãos/uploads interrompidos, métricas/alertas operacionais e teste real de restauração. A fase 6 precisa de aceite específico; o Compose HTTPS sozinho não a conclui.

Antes de liberar equipes, endureça e teste as policies de escrita para distinguir leitor/editor nas tabelas da fase 2. Antes de acesso externo, endureça vínculos projeto/arquivo/vídeo contra gravações diretas maliciosas na Data API e teste essa via, não apenas endpoints da aplicação. O teste IDOR atual cobre projetos pessoais por HTTP, não toda mutação possível pelo Supabase.

Este armazenamento é **single-host**, não efêmero. Não escale API/worker para hosts independentes sem implementar e testar S3/MinIO em `ArmazenamentoArquivos`; isso ainda não foi feito.
