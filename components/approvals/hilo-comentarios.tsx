"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { comentar } from "@/app/(app)/posts/acciones";

export function HiloComentarios({
  postId,
  comentarios,
}: {
  postId: string;
  comentarios: Array<{
    id: string;
    autor: string;
    cuerpo: string;
    fecha: string;
  }>;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!texto.trim()) return;
    setEnviando(true);
    const resultado = await comentar({ postId, cuerpo: texto });
    setEnviando(false);

    if (!resultado.ok) {
      toast.error(resultado.mensaje ?? "No se pudo comentar.");
      return;
    }

    setTexto("");
    router.refresh();
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-medium">Comentarios</h2>

      {comentarios.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavia no hay comentarios.
        </p>
      ) : (
        <ul className="space-y-3">
          {comentarios.map((c) => (
            <li key={c.id} className="text-sm">
              <p>
                <span className="font-medium">{c.autor}</span>{" "}
                <span className="text-xs text-muted-foreground">{c.fecha}</span>
              </p>
              <p className="whitespace-pre-wrap">{c.cuerpo}</p>
            </li>
          ))}
        </ul>
      )}

      <Textarea
        rows={3}
        value={texto}
        placeholder="Escribi un comentario..."
        onChange={(e) => setTexto(e.target.value)}
      />
      <Button
        size="sm"
        className="self-start"
        disabled={enviando || !texto.trim()}
        onClick={() => void enviar()}
      >
        Comentar
      </Button>
    </Card>
  );
}
