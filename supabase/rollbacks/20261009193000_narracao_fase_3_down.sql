-- Remove somente estruturas adicionadas pela fase 3.

begin;
drop policy if exists narracoes_autorizadas on tutoriais.narracoes;
drop index if exists tutoriais.narracoes_bloco_hash_idx;
alter table tutoriais.processamentos drop column if exists configuracao;
alter table tutoriais.processamentos drop constraint if exists processamentos_status_check;
alter table tutoriais.processamentos add constraint processamentos_status_check check (status in (
  'recebido', 'processando_video', 'analisando', 'roteiro_pronto', 'gerando_voz',
  'renderizando', 'concluido', 'erro', 'cancelado'
));
alter table tutoriais.narracoes
  drop column if exists atualizado_em,
  drop column if exists codigo_erro,
  drop column if exists custo_creditos,
  drop column if exists taxa_aceleracao,
  drop column if exists configuracao,
  drop column if exists modelo;
alter table tutoriais.vozes
  drop column if exists atualizado_em,
  drop column if exists configuracao,
  drop column if exists modelo;
commit;
