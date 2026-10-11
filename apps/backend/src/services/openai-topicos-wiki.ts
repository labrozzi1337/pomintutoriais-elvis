import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const respostaSchema = z.object({
  topicos: z.array(z.object({
    inicioIndice: z.number().int().nonnegative(),
    fimIndice: z.number().int().nonnegative(),
    titulo: z.string().trim().min(3).max(80)
  }).strict()).min(1).max(50)
}).strict();

type ClienteResponses = Pick<OpenAI, "responses">;
type BlocoWiki = { inicioMs: number; fimMs: number; acaoVisual: string; narracao: string };

const PROMPT = `Crie o índice de capítulos de uma Wiki a partir dos blocos de um tutorial.
Agrupe ações consecutivas que levam ao mesmo resultado; não crie um capítulo para cada clique, tela ou frase.
O título deve dizer de forma curta o que a pessoa aprende ou executa, nunca descrever o estado visual nem copiar ou resumir a narração.
Na abertura, transforme o tema exibido no objetivo do tutorial. Exemplo: "Levantamento de Débito / CND RFB" vira "Tutorial para levantar débitos da CND RFB".
Em fluxos, nomeie a finalidade. Exemplo: uma página de identificação do gov.br vira "Executando login na plataforma gov.br".
Prefira títulos como "Consulta de pedidos", "Acessando dados do cliente com certificado" e "Extraindo relatório em PDF".
Nunca comece com "A tela", "A página", "A cartela", "Nesta área", "Clique", "Use" ou "Agora".
Cubra todos os índices exatamente uma vez, na ordem recebida, sem lacunas nem sobreposição.`;

export async function gerarTopicosWiki(entrada: {
  apiKey: string;
  modelo: "gpt-6.1-sol" | "gpt-6-astra";
  tituloTutorial: string;
  blocos: BlocoWiki[];
}, cliente?: ClienteResponses): Promise<Array<{ titulo: string; inicioMs: number; fimMs: number }>> {
  if (!entrada.blocos.length) return [];
  const openai = cliente ?? new OpenAI({ apiKey: entrada.apiKey, timeout: 120_000, maxRetries: 2 });
  const resposta = await openai.responses.parse({
    model: entrada.modelo,
    reasoning: { effort: "high" },
    input: [
      { role: "system", content: [{ type: "input_text", text: PROMPT }] },
      { role: "user", content: JSON.stringify({ tituloTutorial: entrada.tituloTutorial, blocos: entrada.blocos.map((bloco, indice) => ({ indice, acaoVisual: bloco.acaoVisual, narracao: bloco.narracao })) }) }
    ],
    text: { format: zodTextFormat(respostaSchema, "topicos_wiki") }
  });
  if (resposta.status !== "completed" || !resposta.output_parsed) throw new Error(`OPENAI_TOPICOS_INCOMPLETE:${resposta.status}`);

  let proximoIndice = 0;
  const topicos = resposta.output_parsed.topicos.map((topico) => {
    if (topico.inicioIndice !== proximoIndice || topico.fimIndice < topico.inicioIndice || topico.fimIndice >= entrada.blocos.length) {
      throw new Error("OPENAI_TOPICOS_INVALID_RANGE");
    }
    proximoIndice = topico.fimIndice + 1;
    return { titulo: topico.titulo, inicioMs: entrada.blocos[topico.inicioIndice]!.inicioMs, fimMs: entrada.blocos[topico.fimIndice]!.fimMs };
  });
  if (proximoIndice !== entrada.blocos.length) throw new Error("OPENAI_TOPICOS_INCOMPLETE_RANGE");
  return topicos;
}
