import "dotenv/config";
import { sql } from "@/db/client";
import { usandoMocks } from "@/lib/platforms/registry";
import { liberarJobsTrabados, tomarJobs } from "./claim";
import { procesarJob } from "./dispatch";

/**
 * Worker de publicacion.
 *
 * Proceso separado del web a proposito: publicar en el minuto exacto necesita
 * algo que este siempre prendido, y una funcion serverless se apaga entre
 * requests. Cada 30 segundos toma hasta 10 jobs vencidos y los procesa.
 */

const WORKER_ID = process.env.WORKER_ID ?? "worker-" + process.pid;
const INTERVALO_MS = Number(process.env.WORKER_INTERVALO_MS ?? "30000");
const LOTE = Number(process.env.WORKER_LOTE ?? "10");

let corriendo = true;
let cicloEnCurso = false;

function log(mensaje: string): void {
  console.log("[" + new Date().toISOString() + "] " + mensaje);
}

async function ciclo(): Promise<void> {
  if (cicloEnCurso) return; // el ciclo anterior todavia no termino
  cicloEnCurso = true;

  try {
    const ahora = new Date();

    const liberados = await liberarJobsTrabados(ahora);
    if (liberados > 0) {
      log("Se devolvieron a la cola " + liberados + " jobs trabados.");
    }

    const jobs = await tomarJobs(WORKER_ID, LOTE, ahora);
    if (jobs.length === 0) return;

    log("Tomados " + jobs.length + " jobs.");

    for (const job of jobs) {
      try {
        const resultado = await procesarJob(job, new Date());
        log(
          "  job " +
            job.id.slice(0, 8) +
            " (intento " +
            job.intentos +
            "/" +
            job.maxIntentos +
            ") -> " +
            resultado,
        );
      } catch (error) {
        // Un job que explota no puede tumbar el ciclo: queda EN_CURSO y el
        // liberador de trabados lo devuelve a la cola en 15 minutos.
        console.error("Error procesando el job " + job.id + ":", error);
      }
    }
  } catch (error) {
    console.error("Error en el ciclo del worker:", error);
  } finally {
    cicloEnCurso = false;
  }
}

async function main(): Promise<void> {
  log("Worker " + WORKER_ID + " arrancando.");
  log("Intervalo: " + INTERVALO_MS + " ms, lote: " + LOTE + ".");
  if (usandoMocks()) {
    log("Adaptadores simulados (USE_MOCK_ADAPTERS): no se llama a ninguna API real.");
  }

  await ciclo();
  const temporizador = setInterval(() => {
    if (corriendo) void ciclo();
  }, INTERVALO_MS);

  const apagar = async (senal: string) => {
    if (!corriendo) return;
    corriendo = false;
    log("Recibi " + senal + ". Termino el ciclo en curso y salgo.");
    clearInterval(temporizador);

    // Esperar a que el ciclo actual cierre, para no dejar jobs EN_CURSO.
    const limite = Date.now() + 30_000;
    while (cicloEnCurso && Date.now() < limite) {
      await new Promise((r) => setTimeout(r, 200));
    }

    await sql.end({ timeout: 5 });
    log("Listo.");
    process.exit(0);
  };

  process.on("SIGINT", () => void apagar("SIGINT"));
  process.on("SIGTERM", () => void apagar("SIGTERM"));
}

main().catch((error) => {
  console.error("El worker no pudo arrancar:", error);
  process.exit(1);
});
