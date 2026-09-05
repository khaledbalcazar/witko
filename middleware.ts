import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesion de Supabase en cada request y bloquea las rutas privadas.
 *
 * El refresco tiene que pasar aca: un Server Component no puede escribir
 * cookies, asi que si el token venciera durante un render el usuario quedaria
 * deslogueado sin motivo.
 */

const RUTAS_PUBLICAS = ["/login", "/auth"];

export async function middleware(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return respuesta;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nuevas) {
        for (const { name, value } of nuevas) {
          request.cookies.set(name, value);
        }
        respuesta = NextResponse.next({ request });
        for (const { name, value, options } of nuevas) {
          respuesta.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;
  const esPublica = RUTAS_PUBLICAS.some((p) => ruta.startsWith(p));

  if (!user && !esPublica) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    destino.searchParams.set("volver", ruta);
    return NextResponse.redirect(destino);
  }

  if (user && ruta === "/login") {
    const destino = request.nextUrl.clone();
    destino.pathname = "/";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return respuesta;
}

export const config = {
  matcher: [
    // Todo menos estaticos, imagenes y el webhook de Meta, que se autentica
    // con su propia firma.
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
