"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ajustarMarca } from "@/app/(app)/admin/acciones";

interface MarcaVista {
  id: string;
  nombre: string;
  timezone: string;
  permitirAutoAprobacion: boolean;
  modoTiktok: "MEDIA_UPLOAD" | "DIRECT_POST";
}

export function PanelMarcas({ marcas }: { marcas: MarcaVista[] }) {
  const router = useRouter();

  async function ajustar(
    id: string,
    cambios: Parameters<typeof ajustarMarca>[1],
  ) {
    const resultado = await ajustarMarca(id, cambios);
    if (!resultado.ok) {
      toast.error(resultado.mensaje ?? "No se pudo guardar.");
      return;
    }
    toast.success("Guardado.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {marcas.map((marca) => (
        <Card key={marca.id} className="space-y-4 p-4">
          <div>
            <h2 className="text-sm font-medium">{marca.nombre}</h2>
            <p className="text-xs text-muted-foreground">
              Zona horaria: {marca.timezone}
            </p>
          </div>

          <label className="flex items-start gap-3">
            <Switch
              checked={marca.permitirAutoAprobacion}
              onCheckedChange={(valor) =>
                void ajustar(marca.id, { permitirAutoAprobacion: valor })
              }
            />
            <span className="text-sm">
              Permitir que un jefe apruebe sus propias publicaciones
              <span className="block text-xs text-muted-foreground">
                Con esto apagado, siempre tiene que revisarla otra persona. Es lo
                recomendado salvo que haya un solo aprobador.
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <p className="text-sm">Modo de publicacion en TikTok</p>
            <Select
              value={marca.modoTiktok}
              items={{
                MEDIA_UPLOAD: "Inbox del creador (recomendado)",
                DIRECT_POST: "Publicacion directa",
              }}
              onValueChange={(valor) =>
                void ajustar(marca.id, {
                  modoTiktok: valor as MarcaVista["modoTiktok"],
                })
              }
            >
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEDIA_UPLOAD">
                  Inbox del creador (recomendado)
                </SelectItem>
                <SelectItem value="DIRECT_POST">Publicacion directa</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Hasta que TikTok apruebe la auditoria de contenido, todo lo que
              publique la app queda en privado. En modo inbox el video llega a la
              app de TikTok y la persona termina de publicarlo desde ahi, sin esa
              restriccion. Cambia a publicacion directa recien cuando la
              auditoria este aprobada.
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}
