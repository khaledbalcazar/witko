import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { socialAccounts } from "@/db/schema";
import { exigirAdmin } from "@/lib/auth/sesion";
import { PanelCuentas } from "@/components/admin/panel-cuentas";

export const metadata = { title: "Cuentas y conexiones" };

/** Dias de aviso antes de que venza un token. */
const DIAS_AVISO = 7;

export default async function PaginaCuentas() {
  const sesion = await exigirAdmin();

  const cuentas = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.brandId, sesion.marcaActiva.id));

  const ahora = Date.now();

  return (
    <PanelCuentas
      brandId={sesion.marcaActiva.id}
      nombreMarca={sesion.marcaActiva.nombre}
      cuentas={cuentas.map((c) => ({
        id: c.id,
        plataforma: c.plataforma,
        externalAccountId: c.externalAccountId,
        nombreVisible: c.nombreVisible,
        activo: c.activo,
        expiraEn: c.expiraEn?.toISOString() ?? null,
        porVencer:
          c.expiraEn != null &&
          c.expiraEn.getTime() - ahora < DIAS_AVISO * 24 * 3600 * 1000,
        vencido: c.expiraEn != null && c.expiraEn.getTime() < ahora,
        tieneToken: c.accessTokenCifrado != null,
      }))}
    />
  );
}
