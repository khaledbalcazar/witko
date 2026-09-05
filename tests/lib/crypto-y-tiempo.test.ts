import { beforeAll, describe, expect, it } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import {
  cifrarToken,
  descifrarToken,
  enmascarar,
  firmaMetaValida,
} from "@/lib/crypto/tokens";
import {
  aUtc,
  desdeFormulario,
  etiquetaDesfase,
  formatearCorto,
  partesFormulario,
} from "@/lib/time/asuncion";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("cifrado de tokens", () => {
  it("va y vuelve", () => {
    const token = "EAAGm0PX4ZCpsBA...token-larguisimo-de-meta";
    expect(descifrarToken(cifrarToken(token))).toBe(token);
  });

  it("cifrar dos veces el mismo token da resultados distintos", () => {
    const token = "mismo-token";
    expect(cifrarToken(token)).not.toBe(cifrarToken(token));
  });

  it("un ciphertext manipulado no se descifra", () => {
    const guardado = cifrarToken("secreto");
    const buffer = Buffer.from(guardado, "base64");
    buffer[buffer.length - 1] ^= 0xff;
    expect(() => descifrarToken(buffer.toString("base64"))).toThrow();
  });

  it("un valor truncado da un error claro", () => {
    expect(() => descifrarToken("YWJj")).toThrow(/truncado o corrupto/);
  });

  it("una clave de largo incorrecto se rechaza", () => {
    const original = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.from("corta").toString("base64");
    expect(() => cifrarToken("x")).toThrow(/32 bytes/);
    process.env.TOKEN_ENCRYPTION_KEY = original;
  });

  it("enmascara sin revelar el medio", () => {
    expect(enmascarar("ABCD1234567890WXYZ")).toBe("ABCD...WXYZ");
    expect(enmascarar("corto")).toBe("********");
  });
});

describe("firma de webhooks de Meta", () => {
  const secret = "app-secret-de-prueba";
  const cuerpo = '{"object":"instagram","entry":[]}';
  const firma =
    "sha256=" + createHmac("sha256", secret).update(cuerpo).digest("hex");

  it("acepta una firma correcta", () => {
    expect(firmaMetaValida(cuerpo, firma, secret)).toBe(true);
  });

  it("rechaza un cuerpo distinto", () => {
    expect(firmaMetaValida(cuerpo + " ", firma, secret)).toBe(false);
  });

  it("rechaza otro secreto", () => {
    expect(firmaMetaValida(cuerpo, firma, "otro")).toBe(false);
  });

  it("rechaza cabecera ausente o sin prefijo", () => {
    expect(firmaMetaValida(cuerpo, null, secret)).toBe(false);
    expect(firmaMetaValida(cuerpo, "deadbeef", secret)).toBe(false);
  });
});

describe("zona horaria de Asuncion", () => {
  it("convierte lo que elige el usuario a UTC", () => {
    // Paraguay quedo en UTC-3 fijo: 14:30 local son las 17:30 UTC.
    const utc = desdeFormulario("2026-03-10", "14:30");
    expect(utc.toISOString()).toBe("2026-03-10T17:30:00.000Z");
  });

  it("muestra en hora local lo que guarda en UTC", () => {
    const utc = new Date("2026-03-10T17:30:00Z");
    expect(formatearCorto(utc)).toBe("10/03/2026 14:30");
  });

  it("el ida y vuelta no pierde el instante", () => {
    const utc = new Date("2026-08-15T03:00:00Z");
    const { fecha, hora } = partesFormulario(utc);
    expect(desdeFormulario(fecha, hora).toISOString()).toBe(utc.toISOString());
  });

  it("informa el desfase que se muestra junto al selector", () => {
    expect(etiquetaDesfase(new Date("2026-03-10T17:30:00Z"))).toBe("UTC-3");
  });

  it("aUtc y desdeFormulario coinciden", () => {
    const local = new Date("2026-03-10T14:30:00");
    expect(aUtc(local).toISOString()).toBe(
      desdeFormulario("2026-03-10", "14:30").toISOString(),
    );
  });
});
