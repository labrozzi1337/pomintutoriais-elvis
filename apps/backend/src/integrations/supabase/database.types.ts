export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Tabela<Linha, Insercao, Atualizacao = Partial<Insercao>> = {
  Row: Linha;
  Insert: Insercao;
  Update: Atualizacao;
  Relationships: [];
};

export interface Database {
  tutoriais: {
    Tables: {
      launcher_dispositivos: Tabela<
        { id: string; proprietario_id: string; token_hash: string; ativo: boolean; criado_em: string },
        { id?: string; proprietario_id: string; token_hash: string; ativo?: boolean; criado_em?: string }
      >;
      launcher_pareamentos: Tabela<
        { id: string; proprietario_id: string; token_hash: string; expira_em: string; consumido_em: string | null; criado_em: string },
        { id?: string; proprietario_id: string; token_hash: string; expira_em: string; consumido_em?: string | null; criado_em?: string }
      >;
      launcher_desafios: Tabela<
        { id: string; proprietario_id: string; dispositivo_id: string; sessao_hash: string; status: string; expira_em: string; respondido_em: string | null; criado_em: string },
        { id?: string; proprietario_id: string; dispositivo_id: string; sessao_hash: string; status?: string; expira_em: string; respondido_em?: string | null; criado_em?: string }
      >;
      app_metadata: Tabela<
        { key: string; value: Json; created_at: string; updated_at: string },
        { key: string; value: Json; created_at: string; updated_at: string }
      >;
      usuarios: Tabela<
        { id: string; auth_id: string | null; email: string; nome: string | null; tipo: "comum" | "admin"; metodo: "local" | "microsoft"; status: "ativo" | "bloqueado"; criado_em: string; atualizado_em: string },
        { id?: string; auth_id?: string | null; email: string; nome?: string | null; tipo?: "comum" | "admin"; metodo?: "local" | "microsoft"; status?: "ativo" | "bloqueado"; criado_em?: string; atualizado_em?: string }
      >;
      wiki_artigos: Tabela<
        { id: string; projeto_id: string; resumo: string; conteudo: string; editado_por: string | null; criado_em: string; atualizado_em: string },
        { id?: string; projeto_id: string; resumo?: string; conteudo?: string; editado_por?: string | null; criado_em?: string; atualizado_em?: string }
      >;
      projetos: Tabela<
        { id: string; titulo: string; descricao: string; tags: string[]; empresa: string; setor: string; empresa_id: string | null; area_id: string | null; proprietario_id: string; equipe_id: string | null; status: string; criado_em: string; atualizado_em: string },
        { id?: string; titulo: string; descricao?: string; tags?: string[]; empresa?: string; setor?: string; empresa_id?: string | null; area_id?: string | null; proprietario_id: string; equipe_id?: string | null; status?: string; criado_em?: string; atualizado_em?: string }
      >;
      empresas: Tabela<
        { id: string; proprietario_id: string; nome: string; criado_em: string },
        { id?: string; proprietario_id: string; nome: string; criado_em?: string }
      >;
      areas: Tabela<
        { id: string; empresa_id: string; proprietario_id: string; nome: string; criado_em: string },
        { id?: string; empresa_id: string; proprietario_id: string; nome: string; criado_em?: string }
      >;
      recordes_cobrinha: Tabela<
        { proprietario_id: string; nickname: string; score: number; atualizado_em: string },
        { proprietario_id: string; nickname: string; score: number; atualizado_em?: string }
      >;
      arquivos: Tabela<
        { id: string; projeto_id: string; tipo: string; chave_armazenamento: string; mime_type: string; tamanho_bytes: number; hash_sha256: string | null; criado_em: string; excluir_apos: string | null },
        { id?: string; projeto_id: string; tipo: string; chave_armazenamento: string; mime_type: string; tamanho_bytes: number; hash_sha256?: string | null; criado_em?: string; excluir_apos?: string | null }
      >;
      videos: Tabela<
        { id: string; projeto_id: string; arquivo_original_id: string; nome_original: string; mime_type: string; tamanho_bytes: number; duracao_ms: number | null; largura: number | null; altura: number | null; fps: number | null; possui_audio: boolean | null; status: string; codigo_erro: string | null; criado_em: string; atualizado_em: string },
        { id?: string; projeto_id: string; arquivo_original_id: string; nome_original: string; mime_type: string; tamanho_bytes: number; duracao_ms?: number | null; largura?: number | null; altura?: number | null; fps?: number | null; possui_audio?: boolean | null; status?: string; codigo_erro?: string | null; criado_em?: string; atualizado_em?: string }
      >;
      processamentos: Tabela<
        { id: string; projeto_id: string; video_id: string | null; tipo: string; status: string; progresso: number; mensagem: string | null; job_id: string | null; tentativas: number; codigo_erro: string | null; cancelamento_solicitado_em: string | null; iniciado_em: string | null; concluido_em: string | null; configuracao: Json; criado_em: string; atualizado_em: string },
        { id?: string; projeto_id: string; video_id?: string | null; tipo: string; status: string; progresso?: number; mensagem?: string | null; job_id?: string | null; tentativas?: number; codigo_erro?: string | null; cancelamento_solicitado_em?: string | null; iniciado_em?: string | null; concluido_em?: string | null; configuracao?: Json; criado_em?: string; atualizado_em?: string }
      >;
      roteiros: Tabela<
        { id: string; projeto_id: string; versao: number; status: string; modelo: string | null; prompt_versao: string | null; uso_provedor: Json | null; edicoes_humanas: boolean; criado_por: string | null; criado_em: string; atualizado_em: string },
        { id?: string; projeto_id: string; versao: number; status?: string; modelo?: string | null; prompt_versao?: string | null; uso_provedor?: Json | null; edicoes_humanas?: boolean; criado_por?: string | null; criado_em?: string; atualizado_em?: string }
      >;
      blocos: Tabela<
        { id: string; roteiro_id: string; ordem: number; inicio_ms: number; fim_ms: number; acao_visual: string; narracao: string; evidencias_frame: Json; confianca: number | null; status: string; versao: number; editado_por_usuario: boolean; criado_em: string; atualizado_em: string },
        { id?: string; roteiro_id: string; ordem: number; inicio_ms: number; fim_ms: number; acao_visual?: string; narracao?: string; evidencias_frame?: Json; confianca?: number | null; status?: string; versao?: number; editado_por_usuario?: boolean; criado_em?: string; atualizado_em?: string }
      >;
      roteiro_eventos: Tabela<
        { id: string; roteiro_id: string; usuario_id: string | null; tipo: string; dados: Json; criado_em: string },
        { id?: string; roteiro_id: string; usuario_id?: string | null; tipo: string; dados?: Json; criado_em?: string }
      >;
      narracoes: Tabela<
        { id: string; bloco_id: string; voz_id: string; arquivo_id: string | null; hash_cache: string | null; duracao_ms: number | null; status: string; tentativas: number; modelo: string; configuracao: Json; taxa_aceleracao: number | null; custo_creditos: number | null; codigo_erro: string | null; criado_em: string; atualizado_em: string },
        { id?: string; bloco_id: string; voz_id: string; arquivo_id?: string | null; hash_cache?: string | null; duracao_ms?: number | null; status?: string; tentativas?: number; modelo?: string; configuracao?: Json; taxa_aceleracao?: number | null; custo_creditos?: number | null; codigo_erro?: string | null; criado_em?: string; atualizado_em?: string }
      >;
      vozes: Tabela<
        { id: string; nome: string; provedor: string; referencia_externa: string; ativa: boolean; modelo: string; configuracao: Json; criado_em: string; atualizado_em: string },
        { id?: string; nome: string; provedor?: string; referencia_externa: string; ativa?: boolean; modelo?: string; configuracao?: Json; criado_em?: string; atualizado_em?: string }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
