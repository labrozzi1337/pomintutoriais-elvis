# Chaves e configuração — sem divulgar segredos

Use o `.env` da raiz para Docker. Não o sobrescreva se já está configurado. Arquivos reais de ambiente são ignorados pelo Git e pelo contexto Docker.

| Variável | Origem / uso |
| --- | --- |
| `START_BACK_SUPABASE_URL` | URL do projeto Supabase. |
| `START_BACK_SUPABASE_ANON_KEY` | Chave pública para validar sessão e consultar com JWT/RLS. |
| `START_BACK_SUPABASE_SERVICE_ROLE_KEY` | Secret privilegiado; somente servidor/worker. Não usar em frontend. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Valores públicos para Auth no navegador; nunca service role. |
| `OPENAI_API_KEY` | Chave privada do projeto OpenAI autorizado, com faturamento/limites configurados. |
| `FISH_API_KEY`, `FISH_VOICE_ID_PRIMARY`, `FISH_VOICE_ID` | Chave privada, voz principal e voz alternativa opcional. Cadastre somente vozes que tem direito de usar. |
| `START_BACK_FISH_MODEL` | `s2.1-pro-free` ou `s2.1-pro`, conforme elegibilidade/plano e termos. |
| `START_BACK_DOWNLOAD_SECRET` | Segredo aleatório próprio do aplicativo; pelo menos 32 caracteres. |
| `START_BACK_ALLOWED_ORIGINS` | Origens exatas separadas por vírgula. Ex.: `http://localhost:8081`. |
| `START_BACK_APP_PORT` | Porta do portal local; deve coincidir com a origem acima. |

Links oficiais: [chaves Supabase](https://supabase.com/dashboard), [projeto OpenAI](https://platform.openai.com/api-keys), [Fish Audio](https://fish.audio/). Confira faturamento/termos no próprio provedor; a aplicação não inventa preços ou saldo disponível.

Depois de alterar chaves/modelo/voz/origens de servidor:

```powershell
docker compose -f compose.yaml up -d api worker frontend
```

Depois de alterar valores públicos `VITE_SUPABASE_*` ou código frontend, faça `up -d --build`. Não publique saída de `docker inspect`, `docker compose config` sem `--quiet`, `.env`, JWTs ou cookies. Se um segredo vazar, revogue/rotacione no provedor e atualize os containers; apagar a mensagem não é rotação.

Trocar `START_BACK_DOWNLOAD_SECRET` invalida acessos de download já emitidos. Trocar voz/modelo muda o cache e pode gerar novas cobranças; confirme antes de regenerar todos os blocos.
