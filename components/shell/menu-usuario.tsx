"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabaseNavegador } from "@/lib/auth/supabase-navegador";

const ETIQUETA_ROL: Record<string, string> = {
  CM: "Community manager",
  JEFE: "Aprobador",
  ADMIN: "Administrador",
};

export function MenuUsuario({
  nombre,
  email,
  rol,
}: {
  nombre: string;
  email: string;
  rol: string;
}) {
  const router = useRouter();

  const iniciales = nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  async function salir() {
    await supabaseNavegador().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            aria-label="Menu de usuario"
          />
        }
      >
        <span className="text-xs font-medium">{iniciales}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {/* Base UI exige que la etiqueta viva dentro de un grupo. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block text-sm font-medium">{nombre}</span>
            <span className="block text-xs text-muted-foreground">{email}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {ETIQUETA_ROL[rol] ?? rol}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void salir()}>
          Cerrar sesion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
