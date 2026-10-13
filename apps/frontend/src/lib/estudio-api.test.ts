import { describe, expect, it } from "vitest";
import { corsArquivo, credenciaisArquivo } from "./estudio-api";

describe("acesso a mídias privadas", () => {
  it("usa CORS anônimo nas URLs assinadas da B2", () => {
    const url = "https://bucket.s3.us-east-005.backblazeb2.com/POMIN-TUTORIAIS/video.mp4";
    expect(credenciaisArquivo(url)).toBe("omit");
    expect(corsArquivo(url)).toBe("anonymous");
  });
  it("mantém cookies nos arquivos locais sem confundir domínios parecidos", () => {
    expect(corsArquivo("/api/v1/videos/id/conteudo")).toBe("use-credentials");
    expect(credenciaisArquivo("https://backblazeb2.com.example.org/video.mp4")).toBe("include");
  });
});
