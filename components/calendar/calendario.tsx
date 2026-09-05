"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  BARRA_ESTADO,
  ETIQUETA_ESTADO,
} from "@/components/estado/estado-post";
import { aHoraLocal, desdeFormulario, formatearLocal } from "@/lib/time/asuncion";
import { reprogramar } from "@/app/(app)/posts/acciones";
import type { EstadoPost } from "@/lib/workflow/types";
import type { Plataforma } from "@/lib/validation/tipos";

export interface PostEnCalendario {
  id: string;
  titulo: string;
  estado: EstadoPost;
  autorId: string;
  autor: string;
  scheduledAt: string;
  plataformas: Plataforma[];
}

const DIAS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

/** Solo estas se pueden mover: el resto todavia no tiene horario comprometido. */
const MOVIBLES: EstadoPost[] = ["APROBADO", "PROGRAMADO"];

export function Calendario({
  publicaciones,
  zona,
  autores,
  puedeMover,
}: {
  publicaciones: PostEnCalendario[];
  zona: string;
  autores: Array<{ id: string; nombre: string }>;
  puedeMover: boolean;
}) {
  const router = useRouter();
  const [vista, setVista] = useState<"mes" | "semana" | "lista">("mes");
  const [ancla, setAncla] = useState(() => new Date());
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [filtroPlataforma, setFiltroPlataforma] = useState<string>("todas");
  const [filtroAutor, setFiltroAutor] = useState<string>("todos");
  const [aConfirmar, setAConfirmar] = useState<{
    post: PostEnCalendario;
    nuevaFecha: string;
  } | null>(null);

  const filtradas = useMemo(
    () =>
      publicaciones.filter(
        (p) =>
          (filtroEstado === "todos" || p.estado === filtroEstado) &&
          (filtroPlataforma === "todas" ||
            p.plataformas.includes(filtroPlataforma as Plataforma)) &&
          (filtroAutor === "todos" || p.autorId === filtroAutor),
      ),
    [publicaciones, filtroEstado, filtroPlataforma, filtroAutor],
  );

  const dias = useMemo(
    () => (vista === "semana" ? diasDeSemana(ancla, zona) : diasDeMes(ancla, zona)),
    [ancla, vista, zona],
  );

  const porDia = useMemo(() => {
    const mapa = new Map<string, PostEnCalendario[]>();
    for (const post of filtradas) {
      const clave = claveDia(new Date(post.scheduledAt), zona);
      const lista = mapa.get(clave) ?? [];
      lista.push(post);
      mapa.set(clave, lista);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    }
    return mapa;
  }, [filtradas, zona]);

  function mover(paso: number) {
    const nueva = new Date(ancla);
    if (vista === "semana") nueva.setDate(nueva.getDate() + paso * 7);
    else nueva.setMonth(nueva.getMonth() + paso);
    setAncla(nueva);
  }

  async function confirmarMovimiento() {
    if (!aConfirmar) return;

    const { post, nuevaFecha } = aConfirmar;
    // Se conserva la hora original y solo cambia el dia.
    const hora = formatearLocal(new Date(post.scheduledAt), "HH:mm", zona);
    const destino = desdeFormulario(nuevaFecha, hora, zona);

    setAConfirmar(null);
    const resultado = await reprogramar(post.id, destino.toISOString());

    if (!resultado.ok) {
      toast.error(resultado.mensaje ?? "No se pudo mover.");
      return;
    }

    toast.success("Movida al " + formatearLocal(destino, "d 'de' MMMM", zona) + ".");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Calendario</h1>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Tabs value={vista} onValueChange={(v) => setVista(v as typeof vista)}>
            <TabsList>
              <TabsTrigger value="mes">Mes</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="lista">Lista</TabsTrigger>
            </TabsList>
          </Tabs>

          {vista !== "lista" && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => mover(-1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAncla(new Date())}>
                Hoy
              </Button>
              <Button variant="outline" size="icon" onClick={() => mover(1)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Filtro
          valor={filtroEstado}
          onCambio={setFiltroEstado}
          ancho="w-[170px]"
          opciones={[
            { valor: "todos", etiqueta: "Todos los estados" },
            ...Object.entries(ETIQUETA_ESTADO).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
            })),
          ]}
        />
        <Filtro
          valor={filtroPlataforma}
          onCambio={setFiltroPlataforma}
          ancho="w-[150px]"
          opciones={[
            { valor: "todas", etiqueta: "Todas las redes" },
            { valor: "INSTAGRAM", etiqueta: "Instagram" },
            { valor: "FACEBOOK", etiqueta: "Facebook" },
            { valor: "TIKTOK", etiqueta: "TikTok" },
          ]}
        />
        <Filtro
          valor={filtroAutor}
          onCambio={setFiltroAutor}
          ancho="w-[170px]"
          opciones={[
            { valor: "todos", etiqueta: "Todos los autores" },
            ...autores.map((a) => ({ valor: a.id, etiqueta: a.nombre })),
          ]}
        />
      </div>

      {vista === "lista" ? (
        <ListaCalendario publicaciones={filtradas} zona={zona} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {formatearLocal(ancla, "MMMM 'de' yyyy", zona)}
          </p>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-sm">
            {DIAS.map((d) => (
              <div
                key={d}
                className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground"
              >
                {d}
              </div>
            ))}

            {dias.map((dia) => {
              const clave = claveDia(dia.fecha, zona);
              const delDia = porDia.get(clave) ?? [];

              return (
                <div
                  key={clave}
                  onDragOver={(e) => puedeMover && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = e.dataTransfer.getData("text/plain");
                    const post = publicaciones.find((p) => p.id === id);
                    if (post) setAConfirmar({ post, nuevaFecha: clave });
                  }}
                  className={cn(
                    "min-h-24 bg-background p-1.5",
                    !dia.delMes && "bg-muted/40",
                  )}
                >
                  <p
                    className={cn(
                      "mb-1 text-xs",
                      dia.esHoy
                        ? "font-semibold text-primary"
                        : "text-muted-foreground",
                    )}
                  >
                    {dia.numero}
                  </p>

                  <div className="space-y-1">
                    {delDia.map((post) => (
                      <TarjetaCalendario
                        key={post.id}
                        post={post}
                        zona={zona}
                        arrastrable={puedeMover && MOVIBLES.includes(post.estado)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={aConfirmar != null} onOpenChange={() => setAConfirmar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover la publicacion</DialogTitle>
            <DialogDescription>
              {aConfirmar && (
                <>
                  &quot;{aConfirmar.post.titulo}&quot; pasa al{" "}
                  {formatearLocal(
                    new Date(aConfirmar.nuevaFecha + "T12:00:00Z"),
                    "d 'de' MMMM",
                    zona,
                  )}
                  , a la misma hora.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAConfirmar(null)}>
              Cancelar
            </Button>
            <Button onClick={() => void confirmarMovimiento()}>Mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TarjetaCalendario({
  post,
  zona,
  arrastrable,
}: {
  post: PostEnCalendario;
  zona: string;
  arrastrable: boolean;
}) {
  return (
    <Link
      href={"/posts/" + post.id}
      draggable={arrastrable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", post.id)}
      className={cn(
        "flex items-center gap-1 rounded border bg-background px-1 py-0.5 text-[11px] hover:bg-accent",
        arrastrable && "cursor-grab active:cursor-grabbing",
      )}
      title={ETIQUETA_ESTADO[post.estado] + " - " + post.autor}
    >
      <span className={cn("h-3 w-1 shrink-0 rounded", BARRA_ESTADO[post.estado])} />
      <span className="shrink-0 tabular-nums text-muted-foreground">
        {formatearLocal(new Date(post.scheduledAt), "HH:mm", zona)}
      </span>
      <span className="truncate">{post.titulo}</span>
    </Link>
  );
}

function ListaCalendario({
  publicaciones,
  zona,
}: {
  publicaciones: PostEnCalendario[];
  zona: string;
}) {
  const ordenadas = [...publicaciones].sort((a, b) =>
    a.scheduledAt.localeCompare(b.scheduledAt),
  );

  if (ordenadas.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No hay publicaciones con fecha que coincidan con los filtros.
      </Card>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {ordenadas.map((post) => (
        <li key={post.id}>
          <Link
            href={"/posts/" + post.id}
            className="flex items-center gap-3 p-3 hover:bg-accent/40"
          >
            <span
              className={cn("h-8 w-1 shrink-0 rounded", BARRA_ESTADO[post.estado])}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{post.titulo}</span>
              <span className="block text-xs text-muted-foreground">
                {post.autor} - {ETIQUETA_ESTADO[post.estado]}
              </span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatearLocal(new Date(post.scheduledAt), "d/MM HH:mm", zona)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Filtro({
  valor,
  onCambio,
  opciones,
  ancho,
}: {
  valor: string;
  onCambio: (valor: string) => void;
  opciones: Array<{ valor: string; etiqueta: string }>;
  ancho: string;
}) {
  return (
    <Select value={valor} onValueChange={(v) => onCambio(v ?? valor)}>
      <SelectTrigger className={ancho} size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.etiqueta}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ------------------------------------------------------------------ */

interface DiaCalendario {
  fecha: Date;
  numero: number;
  delMes: boolean;
  esHoy: boolean;
}

/** Clave estable por dia en la zona de la marca, no en la del navegador. */
function claveDia(fecha: Date, zona: string): string {
  return formatearLocal(fecha, "yyyy-MM-dd", zona);
}

function diasDeMes(ancla: Date, zona: string): DiaCalendario[] {
  const local = aHoraLocal(ancla, zona);
  const primero = new Date(local.getFullYear(), local.getMonth(), 1);

  // La grilla arranca el lunes de la semana del dia 1.
  const desplazamiento = (primero.getDay() + 6) % 7;
  const inicio = new Date(primero);
  inicio.setDate(inicio.getDate() - desplazamiento);

  const hoy = claveDia(new Date(), zona);

  return Array.from({ length: 42 }, (_, i) => {
    const fecha = new Date(inicio);
    fecha.setDate(inicio.getDate() + i);
    return {
      fecha,
      numero: fecha.getDate(),
      delMes: fecha.getMonth() === local.getMonth(),
      esHoy: claveDia(fecha, zona) === hoy,
    };
  });
}

function diasDeSemana(ancla: Date, zona: string): DiaCalendario[] {
  const local = aHoraLocal(ancla, zona);
  const desplazamiento = (local.getDay() + 6) % 7;
  const inicio = new Date(local);
  inicio.setDate(local.getDate() - desplazamiento);

  const hoy = claveDia(new Date(), zona);

  return Array.from({ length: 7 }, (_, i) => {
    const fecha = new Date(inicio);
    fecha.setDate(inicio.getDate() + i);
    return {
      fecha,
      numero: fecha.getDate(),
      delMes: true,
      esHoy: claveDia(fecha, zona) === hoy,
    };
  });
}
