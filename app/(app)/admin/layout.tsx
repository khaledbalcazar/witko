import Link from "next/link";
import { exigirAdmin } from "@/lib/auth/sesion";

export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  await exigirAdmin();

  const secciones = [
    { href: "/admin/cuentas", etiqueta: "Cuentas y conexiones" },
    { href: "/admin/usuarios", etiqueta: "Usuarios" },
    { href: "/admin/marcas", etiqueta: "Marcas" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Administracion</h1>

      <nav className="flex flex-wrap gap-1 border-b pb-2 text-sm">
        {secciones.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {s.etiqueta}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
