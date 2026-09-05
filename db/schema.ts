import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const rolUsuario = pgEnum("rol_usuario", ["CM", "JEFE", "ADMIN"]);

export const plataforma = pgEnum("plataforma", [
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
]);

export const tipoPost = pgEnum("tipo_post", [
  "IG_FEED",
  "IG_CARRUSEL",
  "IG_REEL",
  "IG_STORY",
  "FB_FEED",
  "FB_REEL",
  "TT_VIDEO",
  "TT_FOTO",
]);

export const estadoPost = pgEnum("estado_post", [
  "BORRADOR",
  "EN_REVISION",
  "CAMBIOS_SOLICITADOS",
  "APROBADO",
  "PROGRAMADO",
  "PUBLICANDO",
  "PUBLICADO",
  "FALLIDO",
  "CANCELADO",
]);

/** Estado por destino: un post puede publicar OK en IG y fallar en FB. */
export const estadoTarget = pgEnum("estado_target", [
  "PENDIENTE",
  "PUBLICANDO",
  "PUBLICADO",
  "FALLIDO",
  "CANCELADO",
]);

export const estadoJob = pgEnum("estado_job", [
  "PENDIENTE",
  "EN_CURSO",
  "OK",
  "ERROR",
]);

export const tipoMedia = pgEnum("tipo_media", ["IMAGEN", "VIDEO"]);

export const accionAprobacion = pgEnum("accion_aprobacion", [
  "APROBAR",
  "SOLICITAR_CAMBIOS",
]);

/** MEDIA_UPLOAD deja el video en el inbox del creador; DIRECT_POST publica. */
export const modoTiktok = pgEnum("modo_tiktok", ["MEDIA_UPLOAD", "DIRECT_POST"]);

export const prioridadTarjeta = pgEnum("prioridad_tarjeta", [
  "BAJA",
  "MEDIA",
  "ALTA",
  "URGENTE",
]);

/* ------------------------------------------------------------------ */
/* Usuarios y marcas                                                   */
/* ------------------------------------------------------------------ */

/** El id coincide con auth.users.id de Supabase. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  nombre: text("nombre").notNull(),
  email: text("email").notNull().unique(),
  rol: rolUsuario("rol").notNull().default("CM"),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull(),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull().default("America/Asuncion"),
  /** Si es false, el Jefe no puede aprobar un post del que es autor. */
  permitirAutoAprobacion: boolean("permitir_auto_aprobacion")
    .notNull()
    .default(false),
  modoTiktok: modoTiktok("modo_tiktok").notNull().default("MEDIA_UPLOAD"),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const brandMembers = pgTable(
  "brand_members",
  {
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rol: rolUsuario("rol").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.brandId, t.userId] })],
);

export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    plataforma: plataforma("plataforma").notNull(),
    externalAccountId: text("external_account_id").notNull(),
    nombreVisible: text("nombre_visible").notNull(),
    /** AES-256-GCM. Nunca sale del servidor ni del worker. */
    accessTokenCifrado: text("access_token_cifrado"),
    refreshTokenCifrado: text("refresh_token_cifrado"),
    expiraEn: timestamp("expira_en", { withTimezone: true }),
    scopes: text("scopes").array(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    activo: boolean("activo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("social_accounts_unicas").on(
      t.brandId,
      t.plataforma,
      t.externalAccountId,
    ),
    index("social_accounts_brand_idx").on(t.brandId),
  ],
);

/* ------------------------------------------------------------------ */
/* Publicaciones                                                       */
/* ------------------------------------------------------------------ */

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    autorId: uuid("autor_id")
      .notNull()
      .references(() => users.id),
    tituloInterno: text("titulo_interno").notNull(),
    tipo: tipoPost("tipo").notNull(),
    estado: estadoPost("estado").notNull().default("BORRADOR"),
    /** Mismo horario para todos los destinos del post (decision de diseno). */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivadoAt: timestamp("archivado_at", { withTimezone: true }),
    /** Sube cuando una edicion devuelve el post a BORRADOR. */
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("posts_brand_estado_idx").on(t.brandId, t.estado),
    index("posts_brand_scheduled_idx").on(t.brandId, t.scheduledAt),
    index("posts_autor_idx").on(t.autorId),
  ],
);

export const postTargets = pgTable(
  "post_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    socialAccountId: uuid("social_account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "restrict" }),
    plataforma: plataforma("plataforma").notNull(),
    caption: text("caption").notNull().default(""),
    primerComentario: text("primer_comentario"),
    altText: text("alt_text"),
    isAiGenerated: boolean("is_ai_generated").notNull().default(false),
    locationId: text("location_id"),
    locationNombre: text("location_nombre"),
    /** Opciones especificas de plataforma (privacidad TikTok, feed_targeting FB). */
    config: jsonb("config").$type<Record<string, unknown>>(),
    estado: estadoTarget("estado").notNull().default("PENDIENTE"),
    /** Container de IG entre /media y /media_publish: clave para la idempotencia. */
    externalContainerId: text("external_container_id"),
    externalMediaId: text("external_media_id"),
    permalink: text("permalink"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    errorMensaje: text("error_mensaje"),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("post_targets_unicos").on(t.postId, t.socialAccountId),
    index("post_targets_post_idx").on(t.postId),
  ],
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    orden: integer("orden").notNull(),
    tipo: tipoMedia("tipo").notNull(),
    storagePath: text("storage_path").notNull(),
    /** Meta hace un cURL a esta URL al publicar: tiene que ser publica. */
    urlPublica: text("url_publica").notNull(),
    mime: text("mime").notNull(),
    bytes: integer("bytes").notNull(),
    ancho: integer("ancho"),
    alto: integer("alto"),
    duracionMs: integer("duracion_ms"),
    thumbnailUrl: text("thumbnail_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("media_assets_orden_unico").on(t.postId, t.orden)],
);

/** Etiquetas de usuario. x/y solo aplican a imagenes y stories de Instagram. */
export const mediaTags = pgTable(
  "media_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    postTargetId: uuid("post_target_id")
      .notNull()
      .references(() => postTargets.id, { onDelete: "cascade" }),
    username: text("username").notNull(),
    x: numeric("x", { precision: 5, scale: 4 }),
    y: numeric("y", { precision: 5, scale: 4 }),
  },
  (t) => [index("media_tags_target_idx").on(t.postTargetId)],
);

/* ------------------------------------------------------------------ */
/* Aprobacion y feedback                                               */
/* ------------------------------------------------------------------ */

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    revisorId: uuid("revisor_id")
      .notNull()
      .references(() => users.id),
    accion: accionAprobacion("accion").notNull(),
    comentario: text("comentario"),
    /** Version del post que se reviso, para no aprobar una cosa y publicar otra. */
    postVersion: integer("post_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("approvals_post_idx").on(t.postId, t.createdAt)],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    autorId: uuid("autor_id")
      .notNull()
      .references(() => users.id),
    cuerpo: text("cuerpo").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("comments_post_idx").on(t.postId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Cola de publicacion                                                 */
/* ------------------------------------------------------------------ */

export const publishJobs = pgTable(
  "publish_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postTargetId: uuid("post_target_id")
      .notNull()
      .references(() => postTargets.id, { onDelete: "cascade" }),
    runAt: timestamp("run_at", { withTimezone: true }).notNull(),
    estado: estadoJob("estado").notNull().default("PENDIENTE"),
    intentos: integer("intentos").notNull().default(0),
    maxIntentos: integer("max_intentos").notNull().default(3),
    ultimoError: text("ultimo_error"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("publish_jobs_cola_idx").on(t.estado, t.runAt),
    /** Un solo job activo por destino: segunda red bajo la idempotencia. */
    uniqueIndex("publish_jobs_activo_unico")
      .on(t.postTargetId)
      .where(sql`estado in ('PENDIENTE', 'EN_CURSO')`),
  ],
);

/* ------------------------------------------------------------------ */
/* Tablero de tareas (kanban)                                          */
/* ------------------------------------------------------------------ */

export const boards = pgTable(
  "boards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    descripcion: text("descripcion"),
    archivadoAt: timestamp("archivado_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("boards_brand_idx").on(t.brandId)],
);

/** Columnas personalizables: el equipo las crea, renombra y reordena. */
export const boardColumns = pgTable(
  "board_columns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    /** Fraccional: al arrastrar se calcula el punto medio, sin renumerar todo. */
    orden: doublePrecision("orden").notNull(),
    color: text("color"),
    wipLimite: integer("wip_limite"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("board_columns_board_idx").on(t.boardId, t.orden)],
);

export const boardCards = pgTable(
  "board_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    columnId: uuid("column_id")
      .notNull()
      .references(() => boardColumns.id, { onDelete: "cascade" }),
    orden: doublePrecision("orden").notNull(),
    titulo: text("titulo").notNull(),
    descripcion: text("descripcion"),
    autorId: uuid("autor_id")
      .notNull()
      .references(() => users.id),
    asignadoId: uuid("asignado_id").references(() => users.id, {
      onDelete: "set null",
    }),
    prioridad: prioridadTarjeta("prioridad").notNull().default("MEDIA"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    /** Vincula la tarea con la publicacion que produce, si existe. */
    postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
    archivadoAt: timestamp("archivado_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("board_cards_columna_idx").on(t.columnId, t.orden),
    index("board_cards_asignado_idx").on(t.asignadoId),
    index("board_cards_post_idx").on(t.postId),
  ],
);

export const cardLabels = pgTable(
  "card_labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    color: text("color").notNull(),
  },
  (t) => [uniqueIndex("card_labels_unicas").on(t.boardId, t.nombre)],
);

export const cardLabelLinks = pgTable(
  "card_label_links",
  {
    cardId: uuid("card_id")
      .notNull()
      .references(() => boardCards.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => cardLabels.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.labelId] })],
);

export const cardComments = pgTable(
  "card_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => boardCards.id, { onDelete: "cascade" }),
    autorId: uuid("autor_id")
      .notNull()
      .references(() => users.id),
    cuerpo: text("cuerpo").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("card_comments_card_idx").on(t.cardId, t.createdAt)],
);

export const cardChecklistItems = pgTable(
  "card_checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => boardCards.id, { onDelete: "cascade" }),
    texto: text("texto").notNull(),
    hecho: boolean("hecho").notNull().default(false),
    orden: doublePrecision("orden").notNull(),
  },
  (t) => [index("card_checklist_card_idx").on(t.cardId, t.orden)],
);

/* ------------------------------------------------------------------ */
/* Auditoria                                                           */
/* ------------------------------------------------------------------ */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id),
    entidad: text("entidad").notNull(),
    entidadId: uuid("entidad_id").notNull(),
    accion: text("accion").notNull(),
    diff: jsonb("diff").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_log_entidad_idx").on(t.entidad, t.entidadId, t.createdAt),
  ],
);
