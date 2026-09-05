CREATE TYPE "public"."accion_aprobacion" AS ENUM('APROBAR', 'SOLICITAR_CAMBIOS');--> statement-breakpoint
CREATE TYPE "public"."estado_job" AS ENUM('PENDIENTE', 'EN_CURSO', 'OK', 'ERROR');--> statement-breakpoint
CREATE TYPE "public"."estado_post" AS ENUM('BORRADOR', 'EN_REVISION', 'CAMBIOS_SOLICITADOS', 'APROBADO', 'PROGRAMADO', 'PUBLICANDO', 'PUBLICADO', 'FALLIDO', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."estado_target" AS ENUM('PENDIENTE', 'PUBLICANDO', 'PUBLICADO', 'FALLIDO', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."modo_tiktok" AS ENUM('MEDIA_UPLOAD', 'DIRECT_POST');--> statement-breakpoint
CREATE TYPE "public"."plataforma" AS ENUM('INSTAGRAM', 'FACEBOOK', 'TIKTOK');--> statement-breakpoint
CREATE TYPE "public"."prioridad_tarjeta" AS ENUM('BAJA', 'MEDIA', 'ALTA', 'URGENTE');--> statement-breakpoint
CREATE TYPE "public"."rol_usuario" AS ENUM('CM', 'JEFE', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."tipo_media" AS ENUM('IMAGEN', 'VIDEO');--> statement-breakpoint
CREATE TYPE "public"."tipo_post" AS ENUM('IG_FEED', 'IG_CARRUSEL', 'IG_REEL', 'IG_STORY', 'FB_FEED', 'FB_REEL', 'TT_VIDEO', 'TT_FOTO');--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"revisor_id" uuid NOT NULL,
	"accion" "accion_aprobacion" NOT NULL,
	"comentario" text,
	"post_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"entidad" text NOT NULL,
	"entidad_id" uuid NOT NULL,
	"accion" text NOT NULL,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"column_id" uuid NOT NULL,
	"orden" double precision NOT NULL,
	"titulo" text NOT NULL,
	"descripcion" text,
	"autor_id" uuid NOT NULL,
	"asignado_id" uuid,
	"prioridad" "prioridad_tarjeta" DEFAULT 'MEDIA' NOT NULL,
	"due_at" timestamp with time zone,
	"post_id" uuid,
	"archivado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"orden" double precision NOT NULL,
	"color" text,
	"wip_limite" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text,
	"archivado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_members" (
	"brand_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rol" "rol_usuario" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_members_brand_id_user_id_pk" PRIMARY KEY("brand_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'America/Asuncion' NOT NULL,
	"permitir_auto_aprobacion" boolean DEFAULT false NOT NULL,
	"modo_tiktok" "modo_tiktok" DEFAULT 'MEDIA_UPLOAD' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "card_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"texto" text NOT NULL,
	"hecho" boolean DEFAULT false NOT NULL,
	"orden" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"autor_id" uuid NOT NULL,
	"cuerpo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_label_links" (
	"card_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	CONSTRAINT "card_label_links_card_id_label_id_pk" PRIMARY KEY("card_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "card_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"board_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"color" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"autor_id" uuid NOT NULL,
	"cuerpo" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"orden" integer NOT NULL,
	"tipo" "tipo_media" NOT NULL,
	"storage_path" text NOT NULL,
	"url_publica" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"ancho" integer,
	"alto" integer,
	"duracion_ms" integer,
	"thumbnail_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_asset_id" uuid NOT NULL,
	"post_target_id" uuid NOT NULL,
	"username" text NOT NULL,
	"x" numeric(5, 4),
	"y" numeric(5, 4)
);
--> statement-breakpoint
CREATE TABLE "post_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"social_account_id" uuid NOT NULL,
	"plataforma" "plataforma" NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"primer_comentario" text,
	"alt_text" text,
	"is_ai_generated" boolean DEFAULT false NOT NULL,
	"location_id" text,
	"location_nombre" text,
	"config" jsonb,
	"estado" "estado_target" DEFAULT 'PENDIENTE' NOT NULL,
	"external_container_id" text,
	"external_media_id" text,
	"permalink" text,
	"published_at" timestamp with time zone,
	"error_mensaje" text,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"autor_id" uuid NOT NULL,
	"titulo_interno" text NOT NULL,
	"tipo" "tipo_post" NOT NULL,
	"estado" "estado_post" DEFAULT 'BORRADOR' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"archivado_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publish_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_target_id" uuid NOT NULL,
	"run_at" timestamp with time zone NOT NULL,
	"estado" "estado_job" DEFAULT 'PENDIENTE' NOT NULL,
	"intentos" integer DEFAULT 0 NOT NULL,
	"max_intentos" integer DEFAULT 3 NOT NULL,
	"ultimo_error" text,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"plataforma" "plataforma" NOT NULL,
	"external_account_id" text NOT NULL,
	"nombre_visible" text NOT NULL,
	"access_token_cifrado" text,
	"refresh_token_cifrado" text,
	"expira_en" timestamp with time zone,
	"scopes" text[],
	"metadata" jsonb,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"rol" "rol_usuario" DEFAULT 'CM' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_revisor_id_users_id_fk" FOREIGN KEY ("revisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_cards" ADD CONSTRAINT "board_cards_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_cards" ADD CONSTRAINT "board_cards_column_id_board_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."board_columns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_cards" ADD CONSTRAINT "board_cards_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_cards" ADD CONSTRAINT "board_cards_asignado_id_users_id_fk" FOREIGN KEY ("asignado_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_cards" ADD CONSTRAINT "board_cards_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_members" ADD CONSTRAINT "brand_members_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_members" ADD CONSTRAINT "brand_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_checklist_items" ADD CONSTRAINT "card_checklist_items_card_id_board_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."board_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_comments" ADD CONSTRAINT "card_comments_card_id_board_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."board_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_comments" ADD CONSTRAINT "card_comments_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_label_links" ADD CONSTRAINT "card_label_links_card_id_board_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."board_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_label_links" ADD CONSTRAINT "card_label_links_label_id_card_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."card_labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_labels" ADD CONSTRAINT "card_labels_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_tags" ADD CONSTRAINT "media_tags_post_target_id_post_targets_id_fk" FOREIGN KEY ("post_target_id") REFERENCES "public"."post_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_targets" ADD CONSTRAINT "post_targets_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_targets" ADD CONSTRAINT "post_targets_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_post_target_id_post_targets_id_fk" FOREIGN KEY ("post_target_id") REFERENCES "public"."post_targets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "approvals_post_idx" ON "approvals" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_entidad_idx" ON "audit_log" USING btree ("entidad","entidad_id","created_at");--> statement-breakpoint
CREATE INDEX "board_cards_columna_idx" ON "board_cards" USING btree ("column_id","orden");--> statement-breakpoint
CREATE INDEX "board_cards_asignado_idx" ON "board_cards" USING btree ("asignado_id");--> statement-breakpoint
CREATE INDEX "board_cards_post_idx" ON "board_cards" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "board_columns_board_idx" ON "board_columns" USING btree ("board_id","orden");--> statement-breakpoint
CREATE INDEX "boards_brand_idx" ON "boards" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "card_checklist_card_idx" ON "card_checklist_items" USING btree ("card_id","orden");--> statement-breakpoint
CREATE INDEX "card_comments_card_idx" ON "card_comments" USING btree ("card_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "card_labels_unicas" ON "card_labels" USING btree ("board_id","nombre");--> statement-breakpoint
CREATE INDEX "comments_post_idx" ON "comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_orden_unico" ON "media_assets" USING btree ("post_id","orden");--> statement-breakpoint
CREATE INDEX "media_tags_target_idx" ON "media_tags" USING btree ("post_target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_targets_unicos" ON "post_targets" USING btree ("post_id","social_account_id");--> statement-breakpoint
CREATE INDEX "post_targets_post_idx" ON "post_targets" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "posts_brand_estado_idx" ON "posts" USING btree ("brand_id","estado");--> statement-breakpoint
CREATE INDEX "posts_brand_scheduled_idx" ON "posts" USING btree ("brand_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "posts_autor_idx" ON "posts" USING btree ("autor_id");--> statement-breakpoint
CREATE INDEX "publish_jobs_cola_idx" ON "publish_jobs" USING btree ("estado","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "publish_jobs_activo_unico" ON "publish_jobs" USING btree ("post_target_id") WHERE estado in ('PENDIENTE', 'EN_CURSO');--> statement-breakpoint
CREATE UNIQUE INDEX "social_accounts_unicas" ON "social_accounts" USING btree ("brand_id","plataforma","external_account_id");--> statement-breakpoint
CREATE INDEX "social_accounts_brand_idx" ON "social_accounts" USING btree ("brand_id");