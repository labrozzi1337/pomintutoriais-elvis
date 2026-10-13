export type ItemBuscaGlobal = { id: string; titulo: string; descricao: string; termos: string[]; destino: string; categoria: string };

export function normalizarBusca(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function buscarGlobalmente(itens: ItemBuscaGlobal[], consulta: string): ItemBuscaGlobal[] {
  const termos = normalizarBusca(consulta).split(" ").filter(Boolean);
  if (!termos.length) return itens.slice(0, 8);
  return itens.map((item) => {
    const titulo = normalizarBusca(item.titulo);
    const texto = normalizarBusca([item.titulo, item.descricao, ...item.termos].join(" "));
    if (!termos.every((termo) => texto.includes(termo))) return null;
    const pontuacao = termos.reduce((total, termo) => total + (titulo === termo ? 100 : titulo.startsWith(termo) ? 50 : titulo.includes(termo) ? 25 : 5), 0);
    return { item, pontuacao };
  }).filter((resultado): resultado is { item: ItemBuscaGlobal; pontuacao: number } => resultado !== null)
    .sort((a, b) => b.pontuacao - a.pontuacao || a.item.titulo.localeCompare(b.item.titulo, "pt-BR"))
    .slice(0, 12).map(({ item }) => item);
}
