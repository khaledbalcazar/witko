"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  activarUsuario,
  cambiarRolEnMarca,
  invitarUsuario,
} from "@/app/(app)/admin/acciones";

type Rol = "CM" | "JEFE" | "ADMIN";

const ETIQUETA_ROL: Record<Rol, string> = {
  CM: "Community manager",
  JEFE: "Aprobador",
  ADMIN: "Administrador",
};

interface UsuarioVista {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  marcas: Array<{ brandId: string; rol: Rol }>;
}

export function PanelUsuarios({
  usuarios,
  marcas,
}: {
  usuarios: UsuarioVista[];
  marcas: Array<{ id: string; nombre: string }>;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {usuarios.length} {usuarios.length === 1 ? "usuario" : "usuarios"}
        </p>
        <Button size="sm" onClick={() => setAbierto(true)}>
          <Plus className="size-4" />
          Invitar usuario
        </Button>
      </div>

      <ul className="divide-y rounded-lg border">
        {usuarios.map((usuario) => (
          <li key={usuario.id} className="space-y-2 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{usuario.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {usuario.email}
                </p>
              </div>

              <Badge variant="outline">{ETIQUETA_ROL[usuario.rol]}</Badge>

              {!usuario.activo && <Badge variant="secondary">Inactivo</Badge>}

              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const r = await activarUsuario(usuario.id, !usuario.activo);
                  if (!r.ok) {
                    toast.error(r.mensaje ?? "No se pudo cambiar.");
                    return;
                  }
                  router.refresh();
                }}
              >
                {usuario.activo ? "Desactivar" : "Activar"}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {usuario.marcas.map((m) => {
                const marca = marcas.find((x) => x.id === m.brandId);
                if (!marca) return null;

                return (
                  <div
                    key={m.brandId}
                    className="flex items-center gap-2 rounded-md border px-2 py-1"
                  >
                    <span className="text-xs">{marca.nombre}</span>
                    <Select
                      value={m.rol}
                      items={ETIQUETA_ROL}
                      onValueChange={async (rol) => {
                        const r = await cambiarRolEnMarca(
                          usuario.id,
                          m.brandId,
                          rol as Rol,
                        );
                        if (!r.ok) {
                          toast.error(r.mensaje ?? "No se pudo cambiar.");
                          return;
                        }
                        router.refresh();
                      }}
                    >
                      <SelectTrigger size="sm" className="h-7 w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ETIQUETA_ROL) as Rol[]).map((rol) => (
                          <SelectItem key={rol} value={rol}>
                            {ETIQUETA_ROL[rol]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}

              {usuario.marcas.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  Sin marcas asignadas: no va a poder entrar.
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      <DialogoInvitar
        marcas={marcas}
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
      />
    </div>
  );
}

function DialogoInvitar({
  marcas,
  abierto,
  onCerrar,
}: {
  marcas: Array<{ id: string; nombre: string }>;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("CM");
  const [brandIds, setBrandIds] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [password, setPassword] = useState<string | null>(null);

  function cerrar() {
    setPassword(null);
    setNombre("");
    setEmail("");
    setBrandIds([]);
    onCerrar();
    router.refresh();
  }

  async function invitar() {
    setGuardando(true);
    const resultado = await invitarUsuario({ nombre, email, rol, brandIds });
    setGuardando(false);

    if (!resultado.ok) {
      toast.error(resultado.mensaje ?? "No se pudo invitar.");
      return;
    }

    setPassword(resultado.passwordTemporal ?? null);
  }

  if (password) {
    return (
      <Dialog open onOpenChange={cerrar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuario creado</DialogTitle>
            <DialogDescription>
              Esta contrasena se muestra una sola vez. Pasasela a la persona por
              el canal que uses habitualmente y pedile que la cambie al entrar.
            </DialogDescription>
          </DialogHeader>

          <Card className="flex items-center gap-2 p-3">
            <code className="flex-1 break-all text-sm">{password}</code>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copiar"
              onClick={() => {
                void navigator.clipboard.writeText(password);
                toast.success("Copiada.");
              }}
            >
              <Copy className="size-4" />
            </Button>
          </Card>

          <DialogFooter>
            <Button onClick={cerrar}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar usuario</DialogTitle>
          <DialogDescription>
            Se crea la cuenta con una contrasena temporal. Todavia no se manda
            por correo: falta verificar el dominio de envio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inv-nombre">Nombre</Label>
            <Input
              id="inv-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv-email">Correo</Label>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Rol</Label>
            <Select
              value={rol}
              onValueChange={(v) => setRol(v as Rol)}
              items={ETIQUETA_ROL}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ETIQUETA_ROL) as Rol[]).map((r) => (
                  <SelectItem key={r} value={r}>
                    {ETIQUETA_ROL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Marcas</Label>
            {marcas.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={brandIds.includes(m.id)}
                  onCheckedChange={(valor) =>
                    setBrandIds((previas) =>
                      valor === true
                        ? [...previas, m.id]
                        : previas.filter((id) => id !== m.id),
                    )
                  }
                />
                {m.nombre}
              </label>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            onClick={() => void invitar()}
            disabled={
              guardando || !nombre.trim() || !email.trim() || brandIds.length === 0
            }
          >
            Crear usuario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
