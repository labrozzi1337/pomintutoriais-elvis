-- Apaga apenas pareamentos do Launcher. Backup recomendado antes do rollback manual.
begin;
set local lock_timeout = '15s';
drop table if exists tutoriais.launcher_desafios;
drop table if exists tutoriais.launcher_pareamentos;
drop table if exists tutoriais.launcher_dispositivos;
commit;
