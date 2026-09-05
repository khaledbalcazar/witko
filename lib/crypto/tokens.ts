import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from "node:crypto";

/**
 * Cifrado de tokens de acceso en reposo (AES-256-GCM).
 *
 * Formato guardado: base64(iv | authTag | ciphertext), con iv de 12 bytes y
 * tag de 16. Se guarda como texto para que la columna sea legible desde
 * cualquier cliente sin lidiar con bytea.
 */

const LARGO_IV = 12;
const LARGO_TAG = 16;

function clave(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "Falta TOKEN_ENCRYPTION_KEY. Generala con: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY tiene que ser de 32 bytes en base64, no de " +
        key.length +
        ".",
    );
  }
  return key;
}

export function cifrarToken(textoPlano: string): string {
  const iv = randomBytes(LARGO_IV);
  const cipher = createCipheriv("aes-256-gcm", clave(), iv);
  const cifrado = Buffer.concat([
    cipher.update(textoPlano, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), cifrado]).toString("base64");
}

export function descifrarToken(guardado: string): string {
  const buffer = Buffer.from(guardado, "base64");
  if (buffer.length < LARGO_IV + LARGO_TAG + 1) {
    throw new Error("El token cifrado esta truncado o corrupto.");
  }
  const iv = buffer.subarray(0, LARGO_IV);
  const tag = buffer.subarray(LARGO_IV, LARGO_IV + LARGO_TAG);
  const cifrado = buffer.subarray(LARGO_IV + LARGO_TAG);

  const decipher = createDecipheriv("aes-256-gcm", clave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(cifrado), decipher.final()]).toString(
    "utf8",
  );
}

/**
 * Valida la firma X-Hub-Signature-256 de los webhooks de Meta.
 * La cabecera llega como "sha256=<hex>" y se compara sobre el cuerpo crudo,
 * antes de parsear el JSON.
 */
export function firmaMetaValida(
  cuerpoCrudo: string | Buffer,
  cabecera: string | null,
  appSecret: string,
): boolean {
  if (!cabecera || !cabecera.startsWith("sha256=")) return false;

  const esperado = createHmac("sha256", appSecret)
    .update(cuerpoCrudo)
    .digest("hex");
  const recibido = cabecera.slice("sha256=".length);

  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(recibido, "hex");
  if (a.length !== b.length || a.length === 0) return false;

  return timingSafeEqual(a, b);
}

/** Para mostrar un token en la UI sin exponerlo. */
export function enmascarar(token: string): string {
  if (token.length <= 8) return "********";
  return token.slice(0, 4) + "..." + token.slice(-4);
}
