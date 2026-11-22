-- initial-load: снятие вторичных ограничений auto_migration-схемы.
-- Имена соответствуют DDL, который генерирует module-schema-migration.
ALTER TABLE IF EXISTS "auto_migration"."orders" DROP CONSTRAINT IF EXISTS "fk_orders_user_id";
ALTER TABLE IF EXISTS "auto_migration"."orders" DROP CONSTRAINT IF EXISTS "uk_orders_order_number";
ALTER TABLE IF EXISTS "auto_migration"."users" DROP CONSTRAINT IF EXISTS "uk_users_username";
ALTER TABLE IF EXISTS "auto_migration"."users" DROP CONSTRAINT IF EXISTS "uk_users_email";
