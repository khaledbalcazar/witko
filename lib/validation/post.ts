import { z } from "zod";

/**
 * Esquemas Zod compartidos entre el formulario y las server actions.
 * El cliente los usa para validar mientras se escribe; el servidor los vuelve
 * a aplicar sobre lo que llega, porque el cliente no es de fiar.
 */

export const tipoPostSchema = z.enum([
  "IG_FEED",
  "IG_CARRUSEL",
  "IG_REEL",
  "IG_STORY",
  "FB_FEED",
  "FB_REEL",
  "TT_VIDEO",
  "TT_FOTO",
]);

export const plataformaSchema = z.enum(["INSTAGRAM", "FACEBOOK", "TIKTOK"]);

export const etiquetaMediaSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Falta el usuario.")
    .max(30)
    .regex(/^[A-Za-z0-9._]+$/, "Un usuario solo lleva letras, numeros, punto y guion bajo."),
  /** Posicion relativa sobre la imagen, entre 0 y 1. */
  x: z.number().min(0).max(1).nullable(),
  y: z.number().min(0).max(1).nullable(),
  mediaAssetId: z.string().uuid(),
});

export const configTiktokSchema = z.object({
  titulo: z.string().max(90).optional(),
  privacidad: z.string().optional(),
  permitirComentarios: z.boolean().optional(),
  permitirDuo: z.boolean().optional(),
  permitirStitch: z.boolean().optional(),
  brandOrganicToggle: z.boolean().optional(),
  brandContentToggle: z.boolean().optional(),
});

export const destinoSchema = z.object({
  socialAccountId: z.string().uuid(),
  plataforma: plataformaSchema,
  caption: z.string().default(""),
  primerComentario: z.string().max(2200).nullable().default(null),
  altText: z.string().max(1000).nullable().default(null),
  isAiGenerated: z.boolean().default(false),
  locationId: z.string().nullable().default(null),
  locationNombre: z.string().nullable().default(null),
  config: z
    .object({
      tiktok: configTiktokSchema.optional(),
      facebook: z
        .object({ feedTargeting: z.record(z.string(), z.unknown()).optional() })
        .optional(),
    })
    .default({}),
  etiquetas: z.array(etiquetaMediaSchema).default([]),
});

export const guardarPostSchema = z.object({
  tituloInterno: z
    .string()
    .trim()
    .min(1, "Ponele un titulo interno para reconocerla despues.")
    .max(200),
  tipo: tipoPostSchema,
  /** Orden de los medios ya subidos. */
  mediaIds: z.array(z.string().uuid()).default([]),
  destinos: z.array(destinoSchema).min(1, "Elegi al menos una cuenta de destino."),
  /** Fecha en UTC. Null significa sin programar. */
  scheduledAt: z.coerce.date().nullable().default(null),
});

export type GuardarPost = z.infer<typeof guardarPostSchema>;
export type DestinoFormulario = z.infer<typeof destinoSchema>;

export const crearPostSchema = z.object({
  tituloInterno: z.string().trim().min(1).max(200),
  tipo: tipoPostSchema,
  socialAccountIds: z.array(z.string().uuid()).min(1),
});

export const comentarioSchema = z.object({
  postId: z.string().uuid(),
  cuerpo: z.string().trim().min(1, "Escribi algo.").max(4000),
});
