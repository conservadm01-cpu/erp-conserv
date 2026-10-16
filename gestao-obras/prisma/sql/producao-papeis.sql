-- ---------------------------------------------------------------------------
-- Separação de papéis no PostgreSQL para PRODUÇÃO.
--
-- O trigger de auditoria impede UPDATE/DELETE pela aplicação, mas o DONO das
-- tabelas pode desativá-lo. Por isso, em produção:
--   * obras_owner  -> dono do esquema; usado SOMENTE para migrações (CI/CD).
--   * obras_app    -> usado pela aplicação em execução; sem DDL e sem
--                     UPDATE/DELETE na trilha de auditoria.
-- Execute como superusuário, ajustando as senhas. Rode novamente após cada
-- migração que crie tabelas (ou use os DEFAULT PRIVILEGES abaixo).
-- ---------------------------------------------------------------------------

CREATE ROLE obras_owner LOGIN PASSWORD 'TROQUE-ESTA-SENHA-OWNER';
CREATE ROLE obras_app   LOGIN PASSWORD 'TROQUE-ESTA-SENHA-APP';

ALTER DATABASE obras OWNER TO obras_owner;
ALTER SCHEMA public OWNER TO obras_owner;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO obras_app;

-- Leitura e escrita comuns
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO obras_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO obras_app;

-- Auditoria: somente leitura e inclusão
REVOKE UPDATE, DELETE, TRUNCATE ON audit_event FROM obras_app;
GRANT SELECT, INSERT ON audit_event TO obras_app;

-- Tabelas criadas por migrações futuras (executadas por obras_owner)
ALTER DEFAULT PRIVILEGES FOR ROLE obras_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO obras_app;
ALTER DEFAULT PRIVILEGES FOR ROLE obras_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO obras_app;
