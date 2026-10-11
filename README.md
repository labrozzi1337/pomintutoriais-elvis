# Estúdio de Tutoriais IA — Start Back

Importe MP4 editado no Recordly, gere roteiro visual, revise cenas, gere voz e renderize o tutorial. Portal React/Vite, API Next.js, Redis/BullMQ e worker FFmpeg executam em **Docker**. Supabase existente guarda os dados próprios em **tutoriais**; Auth permanece na infraestrutura do Supabase.

## Abrir a instalação atual

No Windows, abra Docker Desktop e espere o motor iniciar. No PowerShell, entre nesta pasta:

```powershell
docker compose -f compose.yaml up -d
docker compose -f compose.yaml ps
```

Esta instalação usa somente **http://localhost:8081**. O healthcheck fica em `/api/v1/health`; os quatro serviços devem aparecer saudáveis.

Entre com seu usuário Supabase já configurado. Senhas e chaves privadas não pertencem a este documento nem ao bundle. Se receber “Origem não permitida”, inclua a origem exata com a porta em START_BACK_ALLOWED_ORIGINS e recrie os serviços. Não use wildcard.

## Instalação nova

1. Instale Docker Desktop e tenha um projeto Supabase com Auth habilitado.
2. Copie .env.example para .env **somente se ainda não houver .env**. Preencha as variáveis conforme [guia de chaves](docs/api-keys.md).
3. Gere START_BACK_DOWNLOAD_SECRET com pelo menos 32 caracteres aleatórios. Nunca reaproveite senha de usuário ou chave de provedor.
4. No SQL Editor do Supabase, execute **manualmente**, em ordem, as migrations em supabase/migrations. O agente nunca aplica migrations; não existe migration automática na inicialização Docker.
5. Exponha tutoriais em Exposed schemas e crie/autorize o usuário em Supabase Auth. Não crie tabelas próprias em public.
6. Se quiser o pacote de integração no portal, gere-o em Windows com `powershell -NoProfile -File .\launcher-windows\Compilar.ps1` antes do build. O pacote apenas registra o Recordly já instalado para o clique do navegador.
7. Execute `docker compose -f compose.yaml up -d --build`.

Se o banco já estava em uso, **não reaplique as migrations antigas**: execute manualmente somente as posteriores à última já instalada. A Wiki requer `20261010170000_wiki_tutoriais.sql`; edição de descrição, tags e a concessão administrativa solicitada requer `20261011100000_metadados_admin_elvis.sql`.

Em caso de deadlock/lock timeout no SQL Editor, a transação afetada é abortada. Aguarde concorrência/DDL terminar e reexecute o bloco indicado, não termine sessões de outros projetos indiscriminadamente. As migrations das fases 2/3 usam blocos idempotentes; a fase 3 tem commits separados e pode ficar parcialmente instalada até todos os blocos passarem.

## Uso

1. **Novo tutorial** abre um assistente: escolha se já possui o MP4 ou se ainda vai gravar no Recordly; informe Empresa/Setor e envie o arquivo. Upload mostra progresso e pode ser cancelado.
2. Após a validação, abra o editor e reproduza o original. Selecione modelo/tom, leia o aviso e autorize o envio das imagens/textos aos provedores.
3. **Criar tutorial completo** encadeia roteiro, voz, ajuste de ritmo, legendas e render em um único clique. Desmarque a opção quando quiser gerar somente o roteiro para revisão.
4. Acompanhe uma barra única com mensagens claras ou jogue cobrinha sem interromper o worker. Tempos continuam em milissegundos reais.
5. Depois da validação final, revise cenas, reproduza ou baixe MP4, WAV, SRT e VTT. Reabrir o portal preserva jobs e resultados.
6. Ao concluir um tutorial classificado, consulte-o na **Wiki** e complemente o artigo com resumo, pré-requisitos e explicações de aprendizagem.

A biblioteca agrupa os tutoriais em **Empresa → Setor**, captura uma capa real do MP4 antes do clique e pesquisa por título, empresa, setor ou nome do arquivo com sugestões visuais.

O **Recordly é pré-requisito** para gravar a tela. **Abrir Recordly** chama diretamente o aplicativo já instalado; o download oficial só aparece quando a tentativa de abertura falha. Não há gravador alternativo no navegador, launcher intermediário, código ou pareamento. [Instruções e limitações](docs/integracao-recordly.md). A exportação do MP4 no Recordly e sua importação no portal continuam manuais.

## Atualizar, verificar e diagnosticar

```powershell
docker compose -f compose.yaml up -d --build
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs --tail 50 api worker
docker compose -f compose.yaml exec frontend nginx -t
```

Não use **down -v**: apaga os volumes de vídeos/fila. Atualização normal preserva projetos. O backend resolve novamente o DNS interno quando o container API muda; erros 502 persistentes exigem verificar saúde/logs, não apagar dados.

Erros acionáveis: 401 → refaça login; 403 de origem → confira CORS; 413 → reduza arquivo; 409 de edição → atualize o roteiro/aguarde job; Fish restrito/sem crédito → revise plano/modelo/chave; revisão de duração → encurte apenas os blocos indicados. Provedores reais podem gerar custos, mesmo quando uma chamada termina com erro.

## Qualidade, arquitetura e publicação

- [Testes executados e pendências de aceite](docs/testes-e-aceite.md)
- [Deploy HTTPS e backup — preparação, não publicação concluída](docs/deploy-producao.md)
- [Arquitetura](docs/arquitetura-estudio-tutoriais.md)
- [Contrato HTTP](docs/openapi.yaml)

API e worker usam variáveis privadas de servidor. O navegador recebe somente URL/chave pública Supabase para Auth e envia JWT à API; service role, OpenAI, Fish e segredo de download nunca entram em VITE_*. As rotas de usuário consultam com JWT/RLS; credencial privilegiada fica restrita a operações internas verificadas.

A fase 5A depende apenas do aceite interativo no Windows; a migration antiga do launcher não é usada. A fase 6 ainda tem bloqueadores de hardening/operação descritos no guia; **não anunciar como pronto para internet**. Este deploy é single-host com volume persistente, não multi-host/S3.
