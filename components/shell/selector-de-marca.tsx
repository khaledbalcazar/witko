"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cambiarMarca } from "@/app/(app)/acciones";

/**
 * Un usuario puede estar en Witko y en Palma Travel. La marca elegida vive en
 * una cookie del servidor, no en el cliente, para que cada pantalla ya llegue
 * filtrada y no se vea un parpadeo de datos de la otra marca.
 */
export function SelectorDeMarca({
  marcas,
  marcaActivaId,
}: {
  marcas: Array<{ id: string; nombre: string }>;
  marcaActivaId: string;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  if (marcas.length <= 1) {
    return (
      <span className="text-sm text-muted-foreground">
        {marcas[0]?.nombre}
      </span>
    );
  }

  return (
    <Select
      value={marcaActivaId}
      // Sin `items`, Base UI muestra el valor crudo en el disparador: el id de
      // la marca en vez de su nombre.
      items={Object.fromEntries(marcas.map((m) => [m.id, m.nombre]))}
      disabled={pendiente}
      onValueChange={(id) =>
        id &&
        iniciar(async () => {
          await cambiarMarca(id);
          router.refresh();
        })
      }
    >
      <SelectTrigger className="w-[180px]" aria-label="Marca">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {marcas.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {m.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
