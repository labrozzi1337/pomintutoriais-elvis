-- Remove somente estruturas adicionadas pela fase 2.

drop table if exists tutoriais.roteiro_eventos;
drop index if exists tutoriais.processamentos_video_tipo_ativo_idx;
alter table tutoriais.processamentos add constraint processamentos_video_id_tipo_key unique (video_id, tipo);
alter table tutoriais.blocos drop column if exists editado_por_usuario, drop column if exists evidencias_frame;
alter table tutoriais.roteiros drop column if exists edicoes_humanas, drop column if exists criado_por, drop column if exists atualizado_em;
