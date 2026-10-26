CREATE TABLE "ranking"."open_games" (
	"game_id" text PRIMARY KEY NOT NULL,
	"host_name" text NOT NULL,
	"hero_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp NOT NULL
);
