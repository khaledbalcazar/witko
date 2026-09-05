"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabaseNavegador } from "@/lib/auth/supabase-navegador";

export function FormularioLogin({ volver }: { volver: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);

    const supabase = supabaseNavegador();
    const { error: fallo } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (fallo) {
      // No se distingue "no existe" de "contrasena incorrecta" a proposito:
      // decirlo permitiria averiguar que correos tienen cuenta.
      setError("Correo o contrasena incorrectos.");
      setEnviando(false);
      return;
    }

    router.push(volver);
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contrasena</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={enviando}>
        {enviando ? "Ingresando..." : "Ingresar"}
      </Button>

      <p className="text-xs text-muted-foreground">
        Si no tenes cuenta, pedile al administrador que te invite.
      </p>
    </form>
  );
}
