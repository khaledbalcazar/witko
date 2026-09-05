import "server-only";

/**
 * Chequeo de configuracion del primer arranque.
 *
 * Sin esto, la primera pantalla que ve alguien que clona el proyecto es un
 * stack trace de Supabase. Con esto ve que le falta y donde conseguirlo.
 */

export interface VariableFaltante {
  nombre: string;
  donde: string;
}

const REQUERIDAS: VariableFaltante[] = [
  {
    nombre: "NEXT_PUBLIC_SUPABASE_URL",
    donde: "Supabase > Project Settings > API > Project URL",
  },
  {
    nombre: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    donde: "Supabase > Project Settings > API > anon public",
  },
  {
    nombre: "SUPABASE_SERVICE_ROLE_KEY",
    donde: "Supabase > Project Settings > API > service_role",
  },
  {
    nombre: "DATABASE_URL",
    donde: "Supabase > Project Settings > Database > Connection string (URI)",
  },
  {
    nombre: "TOKEN_ENCRYPTION_KEY",
    donde:
      'Generar con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
  },
];

/** Un valor que quedo como placeholder cuenta como faltante. */
function estaVacia(valor: string | undefined): boolean {
  if (!valor || valor.trim() === "") return true;
  return valor.includes("PROYECTO.supabase.co") || valor.includes("PASSWORD@db.");
}

export function variablesFaltantes(): VariableFaltante[] {
  return REQUERIDAS.filter((v) => estaVacia(process.env[v.nombre]));
}

export function configuracionCompleta(): boolean {
  return variablesFaltantes().length === 0;
}
