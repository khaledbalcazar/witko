"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus } from "lucide-react";
import { ICONO_PLATAFORMA } from "@/components/iconos-redes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { desconectarCuenta, guardarCuenta } from "@/app/(app)/admin/acciones";
import { formatearCorto } from "@/lib/time/asuncion";
import type { Plataforma } from "@/lib/validation/tipos";

interface CuentaVista {
  id: string;
  plataforma: Plataforma;
  externalAccountId: string;
  nombreVisible: string;
  activo: boolean;
  expiraEn: string | null;
  porVencer: boolean;
  vencido: boolean;
  tieneToken: boolean;
}

export function PanelCuentas({
  brandId,
  nombreMarca,
  cuentas,
}: {
  brandId: string;
  nombreMarca: string;
  cuentas: CuentaVista[];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  const porVencer = cuentas.filter((c) => c.activo && (c.porVencer || c.vencido));

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-sm">
          Todavia no hay conexion OAuth: las apps de Meta y TikTok estan en
          revision. Mientras tanto se cargan las cuentas a mano y el sistema
          simula la publicacion, asi el equipo puede usar todo el circuito de
          aprobacion desde ya.
        </AlertDescription>
      </Alert>

      {porVencer.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription className="text-sm">
            {porVencer.map((c) => (
              <p key={c.id}>
                El token de {c.nombreVisible}{" "}
                {c.vencido ? "ya vencio" : "vence en menos de 7 dias"}. Hay que
                reconectar la cuenta.
              </p>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Cuentas de {nombreMarca}
        </p>
        <Button size="sm" onClick={() => setAbierto(true)}>
          <Plus className="size-4" />
          Agregar cuenta
        </Button>
      </div>

      {cuentas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Esta marca no tiene cuentas cargadas.
        </Card>
      ) : (
        <ul className="divide-y rounded-lg border">
          {cuentas.map((cuenta) => {
            const Icono = ICONO_PLATAFORMA[cuenta.plataforma];
            return (
              <li key={cuenta.id} className="flex items-center gap-3 p-3">
                <Icono className="size-5 shrink-0 text-muted-foreground" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {cuenta.nombreVisible}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {cuenta.plataforma.toLowerCase()} - id{" "}
                    {cuenta.externalAccountId}
                  </p>
                </div>

                <div className="hidden text-right text-xs text-muted-foreground sm:block">
                  {cuenta.expiraEn
                    ? "Vence " + formatearCorto(new Date(cuenta.expiraEn))
                    : "Token sin vencimiento"}
                </div>

                {cuenta.activo ? (
                  <Badge variant="outline">Conectada</Badge>
                ) : (
                  <Badge variant="secondary">Desconectada</Badge>
                )}

                {cuenta.activo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const r = await desconectarCuenta(cuenta.id);
                      if (!r.ok) {
                        toast.error(r.mensaje ?? "No se pudo desconectar.");
                        return;
                      }
                      router.refresh();
                    }}
                  >
                    Desconectar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <DialogoCuenta
        brandId={brandId}
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
      />
    </div>
  );
}

function DialogoCuenta({
  brandId,
  abierto,
  onCerrar,
}: {
  brandId: string;
  abierto: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [plataforma, setPlataforma] = useState<Plataforma>("INSTAGRAM");
  const [externalAccountId, setExternalAccountId] = useState("");
  const [nombreVisible, setNombreVisible] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true);
    const resultado = await guardarCuenta({
      brandId,
      plataforma,
      externalAccountId,
      nombreVisible,
    });
    setGuardando(false);

    if (!resultado.ok) {
      toast.error(resultado.mensaje ?? "No se pudo guardar.");
      return;
    }

    setExternalAccountId("");
    setNombreVisible("");
    onCerrar();
    router.refresh();
  }

  return (
    <Dialog open={abierto} onOpenChange={onCerrar}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar cuenta</DialogTitle>
          <DialogDescription>
            El identificador es el de la cuenta en la plataforma. Cuando esten
            aprobadas las apps, esto se reemplaza por el boton de conectar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Plataforma</Label>
            <Select
              value={plataforma}
              onValueChange={(v) => setPlataforma(v as Plataforma)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                <SelectItem value="FACEBOOK">Facebook</SelectItem>
                <SelectItem value="TIKTOK">TikTok</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre-cuenta">Nombre visible</Label>
            <Input
              id="nombre-cuenta"
              value={nombreVisible}
              placeholder="palma.travel"
              onChange={(e) => setNombreVisible(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="id-cuenta">Identificador de la cuenta</Label>
            <Input
              id="id-cuenta"
              value={externalAccountId}
              placeholder="17841400000000000"
              onChange={(e) => setExternalAccountId(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            onClick={() => void guardar()}
            disabled={guardando || !nombreVisible.trim() || !externalAccountId.trim()}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
