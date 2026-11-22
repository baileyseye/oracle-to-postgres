-- initial-load: восстановление ограничений auto_migration-схемы после COPY.
SET LOCAL maintenance_work_mem = '512MB';
SET LOCAL max_parallel_maintenance_workers = 4;
ALTER TABLE "auto_migration"."users" ADD CONSTRAINT "uk_users_username" UNIQUE ("username");
ALTER TABLE "auto_migration"."users" ADD CONSTRAINT "uk_users_email" UNIQUE ("email");
ALTER TABLE "auto_migration"."orders" ADD CONSTRAINT "uk_orders_order_number" UNIQUE ("order_number");
ALTER TABLE "auto_migration"."orders" ADD CONSTRAINT "fk_orders_user_id"
  FOREIGN KEY ("user_id") REFERENCES "auto_migration"."users" ("id") NOT VALID;
ALTER TABLE "auto_migration"."orders" VALIDATE CONSTRAINT "fk_orders_user_id";
