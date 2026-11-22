-- initial-load: снятие вторичных ограничений public-схемы.
-- PK не трогаем: он нужен для идентификации и относительно дешёв при COPY.
ALTER TABLE IF EXISTS "public"."orders" DROP CONSTRAINT IF EXISTS "fk_orders_user";
ALTER TABLE IF EXISTS "public"."orders" DROP CONSTRAINT IF EXISTS "uk_orders_order_number";
ALTER TABLE IF EXISTS "public"."users" DROP CONSTRAINT IF EXISTS "uk_users_username";
ALTER TABLE IF EXISTS "public"."users" DROP CONSTRAINT IF EXISTS "uk_users_email";
