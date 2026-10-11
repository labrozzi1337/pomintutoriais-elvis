-- Rollback destrutivo da fase 1; execute somente após backup e confirmação de que não há projetos.

drop table if exists tutoriais.processamentos;
drop table if exists tutoriais.narracoes;
drop table if exists tutoriais.vozes;
drop table if exists tutoriais.blocos;
drop table if exists tutoriais.roteiros;
drop table if exists tutoriais.videos;
drop table if exists tutoriais.arquivos;
drop table if exists tutoriais.projetos;
drop table if exists tutoriais.equipe_membros;
drop table if exists tutoriais.equipes;
