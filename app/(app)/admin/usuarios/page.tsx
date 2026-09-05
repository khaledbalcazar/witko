import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { brandMembers, brands, users } from "@/db/schema";
import { exigirAdmin } from "@/lib/auth/sesion";
import { PanelUsuarios } from "@/components/admin/panel-usuarios";

export const metadata = { title: "Usuarios" };

export default async function PaginaUsuarios() {
  await exigirAdmin();

  const todos = await db.select().from(users).orderBy(asc(users.nombre));
  const marcas = await db
    .select()
    .from(brands)
    .where(eq(brands.activo, true))
    .orderBy(asc(brands.nombre));
  const membresias = await db.select().from(brandMembers);

  return (
    <PanelUsuarios
      marcas={marcas.map((m) => ({ id: m.id, nombre: m.nombre }))}
      usuarios={todos.map((u) => ({
        id: u.id,
        nombre: u.nombre,
        email: u.email,
        rol: u.rol,
        activo: u.activo,
        marcas: membresias
          .filter((m) => m.userId === u.id)
          .map((m) => ({ brandId: m.brandId, rol: m.rol })),
      }))}
    />
  );
}
