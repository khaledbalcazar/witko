import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { brands } from "@/db/schema";
import { exigirAdmin } from "@/lib/auth/sesion";
import { PanelMarcas } from "@/components/admin/panel-marcas";

export const metadata = { title: "Marcas" };

export default async function PaginaMarcas() {
  await exigirAdmin();

  const marcas = await db
    .select()
    .from(brands)
    .where(eq(brands.activo, true))
    .orderBy(asc(brands.nombre));

  return (
    <PanelMarcas
      marcas={marcas.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        timezone: m.timezone,
        permitirAutoAprobacion: m.permitirAutoAprobacion,
        modoTiktok: m.modoTiktok,
      }))}
    />
  );
}
