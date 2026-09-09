CREATE TYPE "public"."proporcion_post" AS ENUM('CUADRADA', 'VERTICAL');--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "proporcion" "proporcion_post";