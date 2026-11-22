-- initial-load: восстановление ограничений public-схемы после COPY.
-- FK создаётся NOT VALID и затем валидируется отдельным шагом.
-- Tune под железо; SET LOCAL действует в транзакции script runner.
SET LOCAL maintenance_work_mem = '512MB';
SET LOCAL max_parallel_maintenance_workers = 4;
ALTER TABLE "public"."users" ADD CONSTRAINT "uk_users_username" UNIQUE ("username");
ALTER TABLE "public"."users" ADD CONSTRAINT "uk_users_email" UNIQUE ("email");
ALTER TABLE "public"."orders" ADD CONSTRAINT "uk_orders_order_number" UNIQUE ("order_number");
ALTER TABLE "public"."orders" ADD CONSTRAINT "fk_orders_user"
  FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") NOT VALID;
ALTER TABLE "public"."orders" VALIDATE CONSTRAINT "fk_orders_user";
