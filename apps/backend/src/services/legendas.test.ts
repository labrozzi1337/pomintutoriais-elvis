import { expect, it } from "vitest";
import { gerarLegendas } from "./legendas";

it("preserva milissegundos, silêncio e remove marcação injetada", () => {
  const cenas = [{ inicioMs: 0, fimMs: 500, texto: "" }, { inicioMs: 135600, fimMs: 140001, texto: "<script>Texto</script>\nnovo -->" }];
  expect(gerarLegendas(cenas, "srt")).toBe("1\n00:02:15,600 --> 00:02:20,001\nTexto novo →\n");
  expect(gerarLegendas(cenas, "vtt")).toContain("WEBVTT\n\n1\n00:02:15.600");
  expect(() => gerarLegendas([{ inicioMs: 10, fimMs: 1, texto: "inválido" }], "srt")).toThrow("SUBTITLE_TIMELINE_INVALID");
});
