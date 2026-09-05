import type { Plataforma } from "@/lib/validation/tipos";
import { MockAdapter } from "./mock";
import type { PlatformAdapter } from "./types";

/**
 * Elige el adaptador de cada plataforma.
 *
 * Con USE_MOCK_ADAPTERS=1 (Fase 0) devuelve siempre el mock: nada sale a
 * internet. En Fase 1 y 2, cuando existan instagram.ts, facebook.ts y
 * tiktok.ts, se registran aca y el resto del sistema no cambia.
 */

export function usandoMocks(): boolean {
  return process.env.USE_MOCK_ADAPTERS !== "0";
}

function opcionesMock() {
  const tasa = Number(process.env.MOCK_TASA_FALLO ?? "0");
  return {
    tasaFallo: Number.isFinite(tasa) ? tasa : 0,
    demoraMs: Number(process.env.MOCK_DEMORA_MS ?? "300"),
  };
}

const cache = new Map<string, PlatformAdapter>();

export function adaptadorDe(plataforma: Plataforma): PlatformAdapter {
  const clave = (usandoMocks() ? "mock:" : "real:") + plataforma;
  const existente = cache.get(clave);
  if (existente) return existente;

  if (!usandoMocks()) {
    // Fase 1 y 2: aca se enchufan InstagramAdapter, FacebookAdapter y
    // TikTokAdapter. Hasta entonces, fallar fuerte es mejor que publicar mal.
    throw new Error(
      "El adaptador real de " +
        plataforma +
        " todavia no esta implementado. Deja USE_MOCK_ADAPTERS=1 hasta la Fase " +
        (plataforma === "TIKTOK" ? "2" : "1") +
        ".",
    );
  }

  const adaptador = new MockAdapter(plataforma, opcionesMock());
  cache.set(clave, adaptador);
  return adaptador;
}

/** Para los tests: descarta las instancias cacheadas. */
export function limpiarRegistro(): void {
  cache.clear();
}
