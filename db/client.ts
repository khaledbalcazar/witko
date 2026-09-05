import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Conexion a Postgres.
 *
 * La conexion se abre en el primer uso, no al importar el modulo. Importa
 * porque `next build` evalua los modulos de cada ruta para recolectar sus
 * datos: si la conexion se creara al importar, el build necesitaria una base
 * viva y las variables de entorno cargadas, cosa que en un CI (o en Vercel
 * antes de configurar el proyecto) no pasa.
 */

/**
 * Una sola conexion por proceso. En dev, Next recarga los modulos en cada
 * cambio; sin este cache se abriria un pool nuevo por recarga hasta agotar las
 * conexiones de Supabase.
 */
const cache = globalThis as unknown as {
  __sqlWitko?: ReturnType<typeof postgres>;
};

/**
 * Host y puerto de la cadena, sin usuario ni contrasena. Sirve para decir a
 * donde se esta intentando conectar sin filtrar credenciales en un log.
 */
function hostDe(url: string): string {
  try {
    const analizada = new URL(url);
    return analizada.hostname + (analizada.port ? ":" + analizada.port : "");
  } catch {
    return "un host que no se pudo interpretar";
  }
}

/** Vercel, y cualquier otro entorno de funciones efimeras. */
function esEntornoSinServidor(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function crearConexion(): ReturnType<typeof postgres> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. En local va en .env.local y .env; en Vercel, en " +
        "Settings > Environment Variables (usando la cadena del transaction pooler).",
    );
  }

  // La conexion directa de Supabase (db.<proyecto>.supabase.co) resuelve solo
  // por IPv6, que no esta disponible en la mayoria de los entornos sin
  // servidor: alli falla con un ENOTFOUND que no dice nada. Se detecta antes
  // de intentar conectar.
  if (esEntornoSinServidor() && /(?:^|@)db\.[a-z0-9]+\.supabase\.co/.test(url)) {
    throw new Error(
      "DATABASE_URL apunta a la conexion directa de Supabase, que no funciona " +
        "en un entorno sin servidor. Esta apuntando a " +
        hostDe(url) +
        " y tiene que apuntar a ...pooler.supabase.com:6543 (Connect > " +
        "Transaction pooler). Revisa que la variable este guardada para el " +
        "entorno Production y volve a desplegar.",
    );
  }

  const conexion = postgres(url, {
    max: process.env.WORKER_ID ? 5 : 10,
    // El pooler de Supabase en modo transaction no admite prepared statements.
    prepare: false,
  });

  if (process.env.NODE_ENV !== "production") {
    cache.__sqlWitko = conexion;
  }

  return conexion;
}

let conexion: ReturnType<typeof postgres> | undefined;

function obtenerConexion(): ReturnType<typeof postgres> {
  conexion ??= cache.__sqlWitko ?? crearConexion();
  return conexion;
}

/**
 * `sql` se usa como plantilla etiquetada (sql`select ...`) y tambien expone
 * metodos (`sql.end()`, `sql.unsafe()`), asi que el proxy intercepta tanto la
 * llamada como el acceso a propiedades.
 */
export const sql = new Proxy(function () {} as unknown as ReturnType<
  typeof postgres
>, {
  apply(_objetivo, _this, argumentos) {
    return (obtenerConexion() as unknown as (...args: unknown[]) => unknown)(
      ...argumentos,
    );
  },
  get(_objetivo, propiedad) {
    const actual = obtenerConexion() as unknown as Record<string, unknown>;
    const valor = actual[propiedad as string];
    return typeof valor === "function" ? valor.bind(actual) : valor;
  },
});

let instanciaDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

function obtenerDb(): ReturnType<typeof drizzle<typeof schema>> {
  instanciaDb ??= drizzle(obtenerConexion(), { schema });
  return instanciaDb;
}

export const db = new Proxy(
  {} as ReturnType<typeof drizzle<typeof schema>>,
  {
    get(_objetivo, propiedad) {
      const actual = obtenerDb() as unknown as Record<string, unknown>;
      const valor = actual[propiedad as string];
      return typeof valor === "function" ? valor.bind(actual) : valor;
    },
  },
);

export type Db = ReturnType<typeof drizzle<typeof schema>>;
