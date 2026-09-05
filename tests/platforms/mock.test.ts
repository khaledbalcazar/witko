import { describe, expect, it } from "vitest";
import { MockAdapter } from "@/lib/platforms/mock";
import { traducirError, esFalloTransitorio } from "@/lib/platforms/errors";
import type {
  CuentaSocial,
  DestinoParaPublicar,
  MediaParaPublicar,
} from "@/lib/platforms/types";
import type { Plataforma, TipoPost } from "@/lib/validation/tipos";

const MB = 1024 * 1024;

function cuenta(plataforma: Plataforma): CuentaSocial {
  return {
    id: "cuenta-" + plataforma,
    brandId: "marca-1",
    plataforma,
    externalAccountId: "1784...",
    nombreVisible: "Palma Travel",
    accessToken: "token-valido",
    refreshToken: null,
    expiraEn: null,
    metadata: null,
  };
}

function destino(
  over: Partial<DestinoParaPublicar> = {},
  plataforma: Plataforma = "INSTAGRAM",
  tipo: TipoPost = "IG_FEED",
): DestinoParaPublicar {
  return {
    id: "destino-0001-aaaa",
    postId: "post-1",
    tipo,
    plataforma,
    cuenta: cuenta(plataforma),
    caption: "Verano en Paraguay",
    primerComentario: null,
    altText: null,
    isAiGenerated: false,
    locationId: null,
    config: {},
    externalContainerId: null,
    externalMediaId: null,
    ...over,
  };
}

function imagen(over: Partial<MediaParaPublicar> = {}): MediaParaPublicar {
  return {
    id: "media-1",
    orden: 0,
    tipo: "IMAGEN",
    urlPublica: "https://storage.test/medios/foto.jpg",
    mime: "image/jpeg",
    bytes: 2 * MB,
    ancho: 1080,
    alto: 1080,
    duracionMs: null,
    etiquetas: [],
    ...over,
  };
}

describe("mock: publicacion", () => {
  it("publica y devuelve id y permalink", async () => {
    const adapter = new MockAdapter("INSTAGRAM");
    const r = await adapter.publish(destino(), [imagen()]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.externalMediaId).toMatch(/^mock-instagram-/);
    expect(r.permalink).toContain("instagram.com");
  });

  it("es idempotente: si ya hay external_media_id no vuelve a publicar", async () => {
    const adapter = new MockAdapter("INSTAGRAM", { tasaFallo: 1 });
    const r = await adapter.publish(
      destino({ externalMediaId: "ya-publicado-123" }),
      [imagen()],
    );
    // Con tasaFallo 1 fallaria siempre; que salga OK prueba que ni lo intento.
    expect(r).toMatchObject({ ok: true, externalMediaId: "ya-publicado-123" });
  });

  it("guarda el container antes de publicar", async () => {
    const adapter = new MockAdapter("INSTAGRAM");
    const guardados: Array<[string, string]> = [];
    await adapter.publish(destino(), [imagen()], {
      guardarContainer: async (destinoId, containerId) => {
        guardados.push([destinoId, containerId]);
      },
    });
    expect(guardados).toHaveLength(1);
    expect(guardados[0][1]).toContain("mock-container-");
  });

  it("no vuelve a crear el container si ya existe uno", async () => {
    const adapter = new MockAdapter("INSTAGRAM");
    let llamadas = 0;
    await adapter.publish(
      destino({ externalContainerId: "container-previo" }),
      [imagen()],
      {
        guardarContainer: async () => {
          llamadas += 1;
        },
      },
    );
    expect(llamadas).toBe(0);
  });

  it("un fallo simulado reintentable se marca como tal", async () => {
    const adapter = new MockAdapter("INSTAGRAM", { tasaFallo: 1 });
    const r = await adapter.publish(destino(), [imagen()]);
    expect(r).toMatchObject({ ok: false, reintentable: true });
  });

  it("un fallo simulado permanente no se reintenta", async () => {
    const adapter = new MockAdapter("INSTAGRAM", {
      tasaFallo: 1,
      falloReintentable: false,
    });
    const r = await adapter.publish(destino(), [imagen()]);
    expect(r).toMatchObject({ ok: false, reintentable: false });
  });

  it("no publica si la validacion falla, y no lo reintenta", async () => {
    const adapter = new MockAdapter("INSTAGRAM");
    const r = await adapter.publish(destino(), [
      imagen({ bytes: 50 * MB }),
    ]);
    expect(r).toMatchObject({
      ok: false,
      codigo: "VALIDACION_LOCAL",
      reintentable: false,
    });
  });

  it("sin token valido no publica", async () => {
    const adapter = new MockAdapter("INSTAGRAM");
    const sinToken = destino();
    sinToken.cuenta = { ...sinToken.cuenta, accessToken: null };
    const r = await adapter.publish(sinToken, [imagen()]);
    expect(r).toMatchObject({ ok: false });
    if (r.ok) return;
    expect(r.mensaje).toMatch(/reconectarla/i);
  });

  it("TikTok en modo inbox avisa que falta terminar de publicar", async () => {
    const adapter = new MockAdapter("TIKTOK");
    const r = await adapter.publish(
      destino({ config: { tiktok: { modo: "MEDIA_UPLOAD" } } }, "TIKTOK", "TT_VIDEO"),
      [
        imagen({
          tipo: "VIDEO",
          mime: "video/mp4",
          duracionMs: 30_000,
          ancho: 1080,
          alto: 1920,
        }),
      ],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.advertencia).toMatch(/inbox/i);
  });

  it("TikTok en DIRECT_POST no muestra ese aviso", async () => {
    const adapter = new MockAdapter("TIKTOK");
    const r = await adapter.publish(
      destino({ config: { tiktok: { modo: "DIRECT_POST" } } }, "TIKTOK", "TT_VIDEO"),
      [
        imagen({
          tipo: "VIDEO",
          mime: "video/mp4",
          duracionMs: 30_000,
          ancho: 1080,
          alto: 1920,
        }),
      ],
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.advertencia).toBeUndefined();
  });
});

describe("mock: validacion", () => {
  it("marca error si el contenido de marca no es publico en TikTok", () => {
    const adapter = new MockAdapter("TIKTOK");
    const r = adapter.validate(
      destino(
        {
          config: {
            tiktok: { brandContentToggle: true, privacidad: "SELF_ONLY" },
          },
        },
        "TIKTOK",
        "TT_VIDEO",
      ),
      [imagen({ tipo: "VIDEO", mime: "video/mp4", duracionMs: 20_000 })],
    );
    expect(r.ok).toBe(false);
    expect(r.problemas.some((p) => p.campo === "privacidad")).toBe(true);
  });

  it("avisa que el alt text se ignora en reels, sin bloquear", () => {
    const adapter = new MockAdapter("INSTAGRAM");
    const r = adapter.validate(
      destino({ altText: "Playa al atardecer" }, "INSTAGRAM", "IG_REEL"),
      [
        imagen({
          tipo: "VIDEO",
          mime: "video/mp4",
          duracionMs: 30_000,
          ancho: 1080,
          alto: 1920,
        }),
      ],
    );
    expect(r.ok).toBe(true);
    expect(
      r.problemas.find((p) => p.campo === "altText")?.nivel,
    ).toBe("AVISO");
  });

  it("avisa que TikTok no publica el primer comentario", () => {
    const adapter = new MockAdapter("TIKTOK");
    const r = adapter.validate(
      destino({ primerComentario: "seguinos!" }, "TIKTOK", "TT_VIDEO"),
      [imagen({ tipo: "VIDEO", mime: "video/mp4", duracionMs: 20_000 })],
    );
    expect(
      r.problemas.find((p) => p.campo === "primerComentario")?.nivel,
    ).toBe("AVISO");
  });
});

describe("mock: cuota", () => {
  it("hay cuota al principio", async () => {
    const adapter = new MockAdapter("INSTAGRAM");
    expect((await adapter.checkQuota(cuenta("INSTAGRAM"))).disponible).toBe(true);
  });

  it("sin cuota informa desde cuando reintentar", async () => {
    const adapter = new MockAdapter("INSTAGRAM", { cuotaDisponible: 0 });
    const estado = await adapter.checkQuota(cuenta("INSTAGRAM"));
    expect(estado.disponible).toBe(false);
    expect(estado.reintentarDespuesDe).toBeInstanceOf(Date);
  });

  it("cada publicacion consume cuota", async () => {
    const adapter = new MockAdapter("INSTAGRAM", { cuotaLimite: 2 });
    const c = cuenta("INSTAGRAM");
    await adapter.publish(destino({ id: "d1" }), [imagen()]);
    await adapter.publish(destino({ id: "d2" }), [imagen()]);
    const estado = await adapter.checkQuota(c);
    expect(estado.usados).toBe(2);
    expect(estado.disponible).toBe(false);
  });
});

describe("traduccion de errores", () => {
  it("el error de auditoria de TikTok se explica en castellano", () => {
    const e = traducirError(
      "TIKTOK",
      "unaudited_client_can_only_post_to_private_accounts",
    );
    expect(e.mensaje).toMatch(/auditoria/i);
    expect(e.mensaje).not.toMatch(/unaudited_client/);
    expect(e.reintentable).toBe(false);
    expect(e.sugerencia).toBeTruthy();
  });

  it("un token vencido de Meta no se reintenta y pide reconectar", () => {
    const e = traducirError("INSTAGRAM", 190);
    expect(e.reintentable).toBe(false);
    expect(e.sugerencia).toMatch(/reconecta/i);
  });

  it("el limite de peticiones si se reintenta", () => {
    expect(traducirError("INSTAGRAM", 17).reintentable).toBe(true);
  });

  it("un codigo desconocido no se reintenta a ciegas", () => {
    const e = traducirError("INSTAGRAM", 999999, "algo raro");
    expect(e.reintentable).toBe(false);
    expect(e.mensaje).toContain("999999");
  });

  it("sin codigo asume problema momentaneo", () => {
    expect(traducirError("FACEBOOK", null).reintentable).toBe(true);
  });

  it("429 y 5xx son transitorios; 400 no", () => {
    expect(esFalloTransitorio(429)).toBe(true);
    expect(esFalloTransitorio(503)).toBe(true);
    expect(esFalloTransitorio(400)).toBe(false);
  });
});
