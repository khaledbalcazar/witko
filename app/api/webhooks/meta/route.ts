import { NextResponse } from "next/server";
import { firmaMetaValida } from "@/lib/crypto/tokens";

/**
 * Webhook de Meta.
 *
 * Esta ruta queda fuera del middleware de sesion a proposito: no la llama un
 * usuario, la llama Meta. Se autentica con la firma HMAC del cuerpo, no con
 * una cookie.
 */

export const runtime = "nodejs";

/** Verificacion inicial de la suscripcion. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const modo = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const desafio = params.get("hub.challenge");

  const esperado = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (modo === "subscribe" && esperado && token === esperado) {
    return new Response(desafio ?? "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.error("Llego un webhook de Meta pero falta META_APP_SECRET.");
    return new Response("Not configured", { status: 503 });
  }

  // La firma se calcula sobre el cuerpo crudo: hay que leerlo como texto antes
  // de parsear el JSON, o el hash no coincide.
  const cuerpo = await request.text();
  const firma = request.headers.get("x-hub-signature-256");

  if (!firmaMetaValida(cuerpo, firma, appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  try {
    const evento = JSON.parse(cuerpo);
    // Fase 1: aca se procesan los avisos de Meta (por ejemplo, que un video
    // termino de procesarse). Por ahora solo se registra.
    console.log("[webhook meta]", JSON.stringify(evento).slice(0, 500));
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  // Meta reintenta si no recibe un 200 rapido, asi que se responde enseguida.
  return NextResponse.json({ ok: true });
}
