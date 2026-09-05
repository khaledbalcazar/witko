"use client";

import { useEffect, useState } from "react";
import { Info, MapPin, Search, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  LIMITE_CAPTION,
  LIMITE_TITULO_TIKTOK,
  MAX_HASHTAGS_INSTAGRAM,
  contarHashtags,
  largo,
  revisarCaption,
} from "@/lib/validation/caption";
import { CAPACIDADES, ETIQUETA_PLATAFORMA } from "@/lib/validation/tipos";
import type { Ubicacion } from "@/lib/places/buscador";
import type {
  CuentaDisponible,
  DestinoEnFormulario,
  EstadoFormulario,
} from "./estado";
import { EtiquetadoSobreImagen } from "./etiquetado";

/** Paso 3. Un caption base, con la opcion de desacoplar por plataforma. */
export function PasoContenido({
  cuentas,
  estado,
  onCambio,
  onCaptionBase,
}: {
  cuentas: CuentaDisponible[];
  estado: EstadoFormulario;
  onCambio: (cambio: Partial<EstadoFormulario>) => void;
  onCaptionBase: (texto: string) => void;
}) {
  function actualizarDestino(
    socialAccountId: string,
    cambio: Partial<DestinoEnFormulario>,
  ) {
    onCambio({
      destinos: estado.destinos.map((d) =>
        d.socialAccountId === socialAccountId ? { ...d, ...cambio } : d,
      ),
    });
  }

  const primero = estado.destinos[0];

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="caption-base">Texto de la publicacion</Label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={estado.captionUnificado}
              onCheckedChange={(activo) => {
                onCambio({ captionUnificado: activo });
                if (activo) onCaptionBase(estado.captionBase);
              }}
            />
            Usar el mismo para todas
          </label>
        </div>

        <Textarea
          id="caption-base"
          rows={6}
          value={estado.captionBase}
          disabled={!estado.captionUnificado}
          placeholder="Escribi el texto que acompana la publicacion..."
          onChange={(e) => onCaptionBase(e.target.value)}
        />

        {!estado.captionUnificado && (
          <p className="text-xs text-muted-foreground">
            Cada plataforma tiene su propio texto. Editalos en las pestanas de
            abajo.
          </p>
        )}
      </div>

      <Tabs defaultValue={primero?.socialAccountId}>
        <TabsList>
          {estado.destinos.map((d) => {
            const cuenta = cuentas.find((c) => c.id === d.socialAccountId);
            return (
              <TabsTrigger key={d.socialAccountId} value={d.socialAccountId}>
                {ETIQUETA_PLATAFORMA[d.plataforma]}
                {cuenta && (
                  <span className="ml-1 hidden text-xs text-muted-foreground sm:inline">
                    {cuenta.nombreVisible}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {estado.destinos.map((destino) => (
          <TabsContent
            key={destino.socialAccountId}
            value={destino.socialAccountId}
            className="space-y-6 pt-4"
          >
            <PanelDestino
              destino={destino}
              estado={estado}
              captionUnificado={estado.captionUnificado}
              onCambio={(cambio) =>
                actualizarDestino(destino.socialAccountId, cambio)
              }
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function PanelDestino({
  destino,
  estado,
  captionUnificado,
  onCambio,
}: {
  destino: DestinoEnFormulario;
  estado: EstadoFormulario;
  captionUnificado: boolean;
  onCambio: (cambio: Partial<DestinoEnFormulario>) => void;
}) {
  const capacidades = CAPACIDADES[destino.plataforma];
  const limite = LIMITE_CAPTION[destino.plataforma];
  const usados = largo(destino.caption);
  const hashtags = contarHashtags(destino.caption);
  const avisos = revisarCaption(destino.caption, destino.plataforma);

  const esImagenInstagram =
    destino.plataforma === "INSTAGRAM" &&
    (estado.tipo === "IG_FEED" || estado.tipo === "IG_CARRUSEL");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Texto</Label>
          <span
            className={cn(
              "text-xs tabular-nums",
              usados > limite ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {usados} / {limite}
          </span>
        </div>

        <Textarea
          rows={6}
          value={destino.caption}
          disabled={captionUnificado}
          onChange={(e) => onCambio({ caption: e.target.value })}
        />

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span
            className={cn(
              destino.plataforma === "INSTAGRAM" &&
                hashtags > MAX_HASHTAGS_INSTAGRAM &&
                "text-amber-600",
            )}
          >
            {hashtags} hashtags
            {destino.plataforma === "INSTAGRAM" &&
              " (Instagram usa " + MAX_HASHTAGS_INSTAGRAM + ")"}
          </span>
        </div>

        {avisos.map((a, i) => (
          <p
            key={i}
            className={cn(
              "text-xs",
              a.nivel === "ERROR" ? "text-destructive" : "text-amber-600",
            )}
          >
            {a.mensaje}
          </p>
        ))}
      </div>

      {destino.plataforma === "TIKTOK" && (
        <OpcionesTiktok destino={destino} onCambio={onCambio} />
      )}

      {esImagenInstagram && (
        <div className="space-y-2">
          <Label htmlFor={"alt-" + destino.socialAccountId}>
            Texto alternativo
          </Label>
          <Input
            id={"alt-" + destino.socialAccountId}
            value={destino.altText ?? ""}
            placeholder="Describi la imagen para quien no puede verla"
            onChange={(e) => onCambio({ altText: e.target.value || null })}
          />
          <p className="text-xs text-muted-foreground">
            Solo se aplica en imagenes de feed y carrusel. La API de Instagram no
            lo acepta en reels ni en historias.
          </p>
        </div>
      )}

      {capacidades.ubicacion && (
        <BuscadorDeUbicacion destino={destino} onCambio={onCambio} />
      )}

      {capacidades.etiquetasConCoordenadas && estado.medios.length > 0 && (
        <EtiquetadoSobreImagen
          medios={estado.medios}
          etiquetas={destino.etiquetas}
          conCoordenadas={estado.tipo !== "IG_REEL"}
          onCambio={(etiquetas) => onCambio({ etiquetas })}
        />
      )}

      {capacidades.primerComentario && (
        <div className="space-y-2">
          <Label htmlFor={"comentario-" + destino.socialAccountId}>
            Primer comentario
          </Label>
          <Textarea
            id={"comentario-" + destino.socialAccountId}
            rows={3}
            value={destino.primerComentario ?? ""}
            placeholder="Los hashtags van comodos aca, para no ensuciar el texto principal."
            onChange={(e) =>
              onCambio({ primerComentario: e.target.value || null })
            }
          />
          <p className="text-xs text-muted-foreground">
            Se publica como comentario propio ni bien sale la publicacion.
          </p>
        </div>
      )}

      {capacidades.etiquetaContenidoIA && (
        <label className="flex items-center gap-3 rounded-lg border p-3">
          <Switch
            checked={destino.isAiGenerated}
            onCheckedChange={(activo) => onCambio({ isAiGenerated: activo })}
          />
          <span className="text-sm">
            Marcar como contenido generado con IA
            <span className="block text-xs text-muted-foreground">
              La plataforma muestra una etiqueta debajo de la publicacion.
            </span>
          </span>
        </label>
      )}

      {destino.plataforma === "INSTAGRAM" && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription className="text-xs">
            Instagram no permite segmentar el publico de una publicacion
            organica: la API no tiene ese campo. Solo los anuncios pagos se
            segmentan, y eso se hace desde el administrador de anuncios.
          </AlertDescription>
        </Alert>
      )}

      {destino.plataforma === "FACEBOOK" && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription className="text-xs">
            La segmentacion organica de Facebook quedo reducida a datos
            demograficos basicos desde que Meta discontinuo el targeting por
            intereses. Esta apagada hasta confirmar, con la API real, que
            aporta algo en estas Paginas.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const PRIVACIDADES = [
  { valor: "PUBLIC_TO_EVERYONE", etiqueta: "Publico" },
  { valor: "MUTUAL_FOLLOW_FRIENDS", etiqueta: "Amigos" },
  { valor: "FOLLOWER_OF_CREATOR", etiqueta: "Seguidores" },
  { valor: "SELF_ONLY", etiqueta: "Solo yo (privado)" },
];

function OpcionesTiktok({
  destino,
  onCambio,
}: {
  destino: DestinoEnFormulario;
  onCambio: (cambio: Partial<DestinoEnFormulario>) => void;
}) {
  const tiktok = destino.config.tiktok ?? {};

  function actualizar(cambio: Partial<typeof tiktok>) {
    const nuevo = { ...tiktok, ...cambio };

    // Regla de TikTok: el contenido marcado como de marca no puede ser privado.
    if (cambio.brandContentToggle) {
      nuevo.privacidad = "PUBLIC_TO_EVERYONE";
    }

    onCambio({ config: { ...destino.config, tiktok: nuevo } });
  }

  const forzadoPublico = tiktok.brandContentToggle === true;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="text-sm font-medium">Opciones de TikTok</p>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={"titulo-tt-" + destino.socialAccountId}>Titulo</Label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {largo(tiktok.titulo ?? "")} / {LIMITE_TITULO_TIKTOK}
          </span>
        </div>
        <Input
          id={"titulo-tt-" + destino.socialAccountId}
          value={tiktok.titulo ?? ""}
          maxLength={LIMITE_TITULO_TIKTOK}
          onChange={(e) => actualizar({ titulo: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Privacidad</Label>
        <Select
          value={tiktok.privacidad ?? "SELF_ONLY"}
          items={Object.fromEntries(
            PRIVACIDADES.map((p) => [p.valor, p.etiqueta]),
          )}
          disabled={forzadoPublico}
          onValueChange={(valor) =>
            actualizar({ privacidad: valor ?? "SELF_ONLY" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIVACIDADES.map((p) => (
              <SelectItem key={p.valor} value={p.valor}>
                {p.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {forzadoPublico
            ? "El contenido de marca tiene que ser publico: TikTok lo exige."
            : "Las opciones reales de la cuenta se leen de TikTok al conectar. Mientras la app no pase la auditoria, todo se publica en privado."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Interruptor
          etiqueta="Permitir comentarios"
          valor={tiktok.permitirComentarios ?? true}
          onCambio={(v) => actualizar({ permitirComentarios: v })}
        />
        <Interruptor
          etiqueta="Permitir duo"
          valor={tiktok.permitirDuo ?? false}
          onCambio={(v) => actualizar({ permitirDuo: v })}
        />
        <Interruptor
          etiqueta="Permitir stitch"
          valor={tiktok.permitirStitch ?? false}
          onCambio={(v) => actualizar({ permitirStitch: v })}
        />
      </div>

      <div className="space-y-3 border-t pt-3">
        <Interruptor
          etiqueta="Promociono mi propio negocio"
          valor={tiktok.brandOrganicToggle ?? false}
          onCambio={(v) => actualizar({ brandOrganicToggle: v })}
        />
        <Interruptor
          etiqueta="Contenido pago de una marca"
          valor={tiktok.brandContentToggle ?? false}
          onCambio={(v) => actualizar({ brandContentToggle: v })}
        />
      </div>
    </div>
  );
}

function Interruptor({
  etiqueta,
  valor,
  onCambio,
}: {
  etiqueta: string;
  valor: boolean;
  onCambio: (valor: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch checked={valor} onCheckedChange={onCambio} />
      {etiqueta}
    </label>
  );
}

/* ------------------------------------------------------------------ */

function BuscadorDeUbicacion({
  destino,
  onCambio,
}: {
  destino: DestinoEnFormulario;
  onCambio: (cambio: Partial<DestinoEnFormulario>) => void;
}) {
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<Ubicacion[]>([]);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (consulta.trim().length < 2) {
      setResultados([]);
      return;
    }

    const temporizador = setTimeout(async () => {
      setBuscando(true);
      try {
        const respuesta = await fetch(
          "/api/ubicaciones?q=" + encodeURIComponent(consulta),
        );
        const datos = await respuesta.json();
        setResultados(datos.resultados ?? []);
      } finally {
        setBuscando(false);
      }
    }, 250);

    return () => clearTimeout(temporizador);
  }, [consulta]);

  if (destino.locationId) {
    return (
      <div className="space-y-2">
        <Label>Ubicacion</Label>
        <div className="flex items-center gap-2 rounded-lg border p-3">
          <MapPin className="size-4 text-muted-foreground" />
          <span className="text-sm">{destino.locationNombre}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto"
            aria-label="Quitar ubicacion"
            onClick={() =>
              onCambio({ locationId: null, locationNombre: null })
            }
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={"ubicacion-" + destino.socialAccountId}>Ubicacion</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={"ubicacion-" + destino.socialAccountId}
          className="pl-9"
          value={consulta}
          placeholder="Buscar un lugar..."
          onChange={(e) => setConsulta(e.target.value)}
        />
      </div>

      {buscando && (
        <p className="text-xs text-muted-foreground">Buscando...</p>
      )}

      {resultados.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {resultados.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onCambio({ locationId: u.id, locationNombre: u.nombre });
                  setConsulta("");
                  setResultados([]);
                }}
              >
                <span className="block font-medium">{u.nombre}</span>
                <span className="block text-xs text-muted-foreground">
                  {u.direccion} - {u.ciudad}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Solo se pueden etiquetar lugares con direccion fisica. No se puede
        escribir una ubicacion a mano: la API pide un identificador.
      </p>
    </div>
  );
}
