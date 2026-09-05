import { describe, expect, it } from "vitest";
import {
  LIMITES,
  validarArchivo,
  validarConjunto,
  type ArchivoCandidato,
} from "@/lib/validation/media-limits";
import {
  contarHashtags,
  extraerMenciones,
  largo,
  revisarCaption,
  revisarTituloTiktok,
  truncarComoFeed,
} from "@/lib/validation/caption";
import { CAPACIDADES, PLATAFORMA_DE_TIPO } from "@/lib/validation/tipos";

const MB = 1024 * 1024;

function imagen(over: Partial<ArchivoCandidato> = {}): ArchivoCandidato {
  return {
    nombre: "foto.jpg",
    mime: "image/jpeg",
    bytes: 2 * MB,
    ancho: 1080,
    alto: 1080,
    ...over,
  };
}

function video(over: Partial<ArchivoCandidato> = {}): ArchivoCandidato {
  return {
    nombre: "clip.mp4",
    mime: "video/mp4",
    bytes: 30 * MB,
    ancho: 1080,
    alto: 1920,
    duracionSeg: 30,
    ...over,
  };
}

describe("validacion de archivos", () => {
  it("acepta una imagen cuadrada para el feed de Instagram", () => {
    expect(validarArchivo(imagen(), "IG_FEED")).toBeNull();
  });

  it("rechaza un video en un post de feed y explica que acepta", () => {
    const p = validarArchivo(video(), "IG_FEED");
    expect(p?.mensaje).toMatch(/no acepta videos/i);
  });

  it("rechaza un formato no admitido nombrando los que si", () => {
    const p = validarArchivo(imagen({ mime: "image/gif" }), "IG_FEED");
    expect(p?.mensaje).toMatch(/JPEG, PNG/);
  });

  it("el mensaje de peso dice cuanto pesa y cual es el limite", () => {
    const p = validarArchivo(imagen({ bytes: 12 * MB }), "IG_FEED");
    expect(p?.mensaje).toContain("12 MB");
    expect(p?.mensaje).toContain("8 MB");
  });

  it("rechaza un reel mas corto que el minimo", () => {
    const p = validarArchivo(video({ duracionSeg: 2 }), "IG_REEL");
    expect(p?.mensaje).toMatch(/minimo es 3 segundos/);
  });

  it("rechaza un reel mas largo que 15 minutos", () => {
    const p = validarArchivo(video({ duracionSeg: 16 * 60 }), "IG_REEL");
    expect(p?.mensaje).toMatch(/maximo es 15 minutos/);
  });

  it("acepta un reel vertical de duracion valida", () => {
    expect(validarArchivo(video({ duracionSeg: 45 }), "IG_REEL")).toBeNull();
  });

  it("rechaza un reel horizontal por proporcion", () => {
    const p = validarArchivo(
      video({ ancho: 1920, alto: 1080 }),
      "IG_REEL",
    );
    expect(p?.mensaje).toMatch(/proporcion/i);
  });

  it("la story no admite videos de mas de 60 segundos", () => {
    const p = validarArchivo(video({ duracionSeg: 90 }), "IG_STORY");
    expect(p?.mensaje).toMatch(/maximo es 1 minuto./);
  });

  it("TikTok usa el limite que devuelve la cuenta, no uno fijo", () => {
    const largoVideo = video({ duracionSeg: 700, ancho: null, alto: null });
    // Sin dato de la cuenta cae al fallback de 600 s y lo rechaza.
    expect(validarArchivo(largoVideo, "TT_VIDEO")?.mensaje).toMatch(/maximo/);
    // Con una cuenta que permite 15 minutos, pasa.
    expect(validarArchivo(largoVideo, "TT_VIDEO", 900)).toBeNull();
  });
});

describe("validacion del conjunto", () => {
  it("el carrusel necesita al menos dos elementos", () => {
    const p = validarConjunto([imagen()], "IG_CARRUSEL");
    expect(p[0].mensaje).toMatch(/al menos 2/);
  });

  it("el carrusel no admite mas de diez", () => {
    const once = Array.from({ length: 11 }, () => imagen());
    const p = validarConjunto(once, "IG_CARRUSEL");
    expect(p[0].mensaje).toMatch(/maximo es 10/);
  });

  it("diez elementos exactos estan bien", () => {
    const diez = Array.from({ length: 10 }, () => imagen());
    expect(validarConjunto(diez, "IG_CARRUSEL")).toHaveLength(0);
  });

  it("un post sin archivos se rechaza", () => {
    expect(validarConjunto([], "IG_FEED")).toHaveLength(1);
  });
});

describe("caption", () => {
  it("cuenta emojis como un caracter, no como dos", () => {
    expect(largo("hola 👋")).toBe(6);
  });

  it("marca error cuando pasa el limite de Instagram", () => {
    const avisos = revisarCaption("x".repeat(2201), "INSTAGRAM");
    expect(avisos[0]).toMatchObject({ nivel: "ERROR" });
    expect(avisos[0].mensaje).toMatch(/Sobran 1/);
  });

  it("2200 caracteres exactos pasan", () => {
    expect(revisarCaption("x".repeat(2200), "INSTAGRAM")).toHaveLength(0);
  });

  it("avisa al pasar de 30 hashtags en Instagram", () => {
    const texto = Array.from({ length: 31 }, (_, i) => "#tag" + i).join(" ");
    const avisos = revisarCaption(texto, "INSTAGRAM");
    expect(avisos[0]).toMatchObject({ nivel: "AVISO" });
    expect(avisos[0].mensaje).toMatch(/31 hashtags/);
  });

  it("Facebook no tiene aviso de hashtags", () => {
    const texto = Array.from({ length: 40 }, (_, i) => "#tag" + i).join(" ");
    expect(revisarCaption(texto, "FACEBOOK")).toHaveLength(0);
  });

  it("cuenta hashtags con acentos y numeros", () => {
    expect(contarHashtags("#verano2026 #ñandutí #Asunción")).toBe(3);
  });

  it("extrae menciones sin la arroba", () => {
    expect(extraerMenciones("gracias @palma.travel y @witko_py")).toEqual([
      "palma.travel",
      "witko_py",
    ]);
  });

  it("el titulo de TikTok se corta en 90", () => {
    expect(revisarTituloTiktok("t".repeat(90))).toHaveLength(0);
    expect(revisarTituloTiktok("t".repeat(91))[0].nivel).toBe("ERROR");
  });

  it("trunca la vista previa como el feed", () => {
    const texto = "a".repeat(200);
    const r = truncarComoFeed(texto, "INSTAGRAM");
    expect(r.visible).toHaveLength(125);
    expect(r.hayMas).toBe(true);
  });

  it("un texto corto no se trunca", () => {
    expect(truncarComoFeed("hola", "INSTAGRAM")).toEqual({
      visible: "hola",
      hayMas: false,
    });
  });
});

describe("capacidades por plataforma", () => {
  it("Instagram organico no tiene segmentacion de publico", () => {
    expect(CAPACIDADES.INSTAGRAM.segmentacionOrganica).toBe(false);
  });

  it("TikTok no permite primer comentario por API", () => {
    expect(CAPACIDADES.TIKTOK.primerComentario).toBe(false);
  });

  it("solo Instagram tiene etiquetas con coordenadas", () => {
    expect(CAPACIDADES.INSTAGRAM.etiquetasConCoordenadas).toBe(true);
    expect(CAPACIDADES.FACEBOOK.etiquetasConCoordenadas).toBe(false);
    expect(CAPACIDADES.TIKTOK.etiquetasConCoordenadas).toBe(false);
  });

  it("cada tipo de post pertenece a una sola plataforma", () => {
    for (const tipo of Object.keys(LIMITES) as Array<keyof typeof LIMITES>) {
      expect(PLATAFORMA_DE_TIPO[tipo]).toBeDefined();
    }
  });
});
