CREATE SCHEMA "forge";
--> statement-breakpoint
CREATE TABLE "forge"."inventory" (
	"item_id" text PRIMARY KEY NOT NULL,
	"player_id" text NOT NULL,
	"recipe_id" text NOT NULL,
	"crafted_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "inventory_player_idx" ON "forge"."inventory" USING btree ("player_id");
