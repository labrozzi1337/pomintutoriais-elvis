# Testes e aceite — 09/10/2026

Resultados medidos; testes simulados não são usados como prova de geração real.

## Passou

| Verificação | Evidência |
| --- | --- |
| Unitários/integração | 30 testes em 19 arquivos; Redis real e FFmpeg real no container; regressões de nova análise após job legado e de exclusão física com chave forjada. |
| Timeline | Sobreposição, milissegundos, silêncio, dividir/unir; fixture real de **135600 ms / 16 blocos** dividida em 17 e reunida em 16; versão antiga rejeitada com 409. |
| Áudio | Exatos 12% / rejeição acima e de zero segundos, corrompido, MP4 sem áudio, três modos de mix, cancelamento durante FFmpeg e descarte do produto temporário. |
| Provedores em testes | Fish 429 com retry limitado, rede/cancelamento; OpenAI timeout propagado. Nenhuma API paga nesses testes. |
| E2E simulado | Importar, editar, consentir, gerar, baixar, recarregar e largura móvel de 390 px; captura simulada testa limite de tamanho/duração e descarte sem arquivo incompleto. Mocks existem apenas em `tests`. |
| E2E real | Sessão autorizada, roteiro existente, player de MP4 H.264/AAC, download e refresh; anon 401 e origem externa 403. |
| Segurança real | Usuário temporário sem acesso ao projeto/vídeo/MP4 de outro usuário (404); conteúdo sem cookie (401); tamanho acima do limite (413), extensão não MP4 (415); arquivo de MIME HTML inserido diretamente na Data API teve acesso negado (404). Exclusão HTTP autorizada passou; fixture e usuário temporários removidos. |
| Render real do projeto existente | 16 MP3s verificados e reutilizados do cache; MP4, WAV, SRT e VTT persistidos. Duração original **155600 ms**, distinta da fixture de 135600 ms. Não houve nova geração de voz nesse re-render. |
| Integração Recordly | O protocolo do Windows foi registrado diretamente para o Recordly 1.4.0 instalado, sem launcher, código ou pareamento. O pacote contém somente instalar/remover a associação. |

Última execução: **30 testes unitários/integração e 4 E2E passaram**, lint/TypeScript e builds Docker passaram; nginx, Compose HTTPS, Caddy e YAML OpenAPI tiveram configuração validada. `npm audit --omit=dev` retornou **zero alertas**; restam **8 alertas de desenvolvimento (6 altos / 2 moderados)**. O worker de produção remove dependências de desenvolvimento. Não é auditoria de vulnerabilidades do sistema operacional/imagens. Não use `npm audit fix --force` sem testar mudanças de stack.

## Reproduzir sem executar a aplicação fora do Docker

```powershell
docker build -f tests/Dockerfile -t start-back-tests .
docker run --rm --network start-back_default -e TEST_REDIS_URL=redis://redis:6379 --entrypoint sh start-back-tests -c "npm test && npm run lint && npm run typecheck"
docker run --rm start-back-tests
```

O último comando roda o E2E simulado na aplicação local da porta 8081. Para testes reais, adicione `--env-file .env -e E2E_EMAIL=SEU_USUARIO_AUTORIZADO`. Não coloque senha/token no arquivo de testes. O teste usa uma sessão curta autorizada, encerra a sessão e não imprime JWTs. Ajuste `E2E_PORT` e `E2E_BASE_URL=http://localhost:PORTA` caso mude a porta.

O teste de segurança cria somente fixtures identificadas por UUID e as remove no `finally`. Não altera projetos existentes nem aplica SQL/migrations. Execute testes reais apenas contra ambiente autorizado. Traces estão desabilitados; não publique screenshots/relatórios com gravações/textos reais.

## Pendências — sem declaração de pronto para internet

1. Abertura/cancelamento do protocolo pelo clique em navegador interativo, reinstalação e cenário sem Recordly. O fluxo atual não exige launcher, migration nem pareamento.
2. A exportação no Recordly e a importação manual do MP4 continuam separadas; a versão oficial auditada não oferece callback de exportação para automatizar essa passagem.
3. Miniaturas autenticadas na biblioteca/cenas e amostra independente para prévia da voz; hoje existe prévia real do MP3 já gerado por bloco. Campos extras da biblioteca/admin de vozes ainda precisam de acabamento.
4. Edição isolada seguida de nova chamada Fish e prova de reutilização das demais vozes; auto-reescrita real de bloco longo. A lógica tem testes, mas não foi gasto crédito adicional apenas para completar essa matriz.
5. Hardening/quotas/retenção e métricas descritos em `deploy-producao.md`, policies de equipe/leitor e mutações diretas da Data API, restauração e publicação HTTPS no servidor real.
6. Auditoria dos alertas de dependências de desenvolvimento ainda sem patch compatível; atualizações maiores precisam de novo aceite.

As fases 5A e 6 não estão concluídas apenas porque há código/pacote/configuração. Faça o aceite Windows e feche os bloqueadores antes de liberar para terceiros.
