/**
 * Busqueda de ubicaciones.
 *
 * Instagram y Facebook solo aceptan un `location_id` de una Pagina con
 * direccion fisica: no existe la ubicacion escrita a mano. Por eso la UI nunca
 * ofrece texto libre, ni siquiera ahora que la busqueda es simulada.
 *
 * En Fase 1 se reemplaza el buscador simulado por la Pages Search API, que
 * necesita App Review. Como el contrato es el mismo, ni la UI ni los datos
 * guardados cambian.
 */

export interface Ubicacion {
  /** El id que se manda a la API al publicar. */
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
}

export interface BuscadorUbicaciones {
  buscar(consulta: string): Promise<Ubicacion[]>;
}

/** Lugares de prueba de Asuncion y alrededores, para poder usar la app hoy. */
const SIMULADAS: Ubicacion[] = [
  { id: "sim-001", nombre: "Costanera de Asuncion", direccion: "Av. Costanera Jose Asuncion Flores", ciudad: "Asuncion" },
  { id: "sim-002", nombre: "Paseo La Galeria", direccion: "Av. Santa Teresa esq. Aviadores del Chaco", ciudad: "Asuncion" },
  { id: "sim-003", nombre: "Shopping del Sol", direccion: "Av. Aviadores del Chaco 3500", ciudad: "Asuncion" },
  { id: "sim-004", nombre: "Panteon Nacional de los Heroes", direccion: "Palma esq. Chile", ciudad: "Asuncion" },
  { id: "sim-005", nombre: "Loma San Jeronimo", direccion: "Barrio San Jeronimo", ciudad: "Asuncion" },
  { id: "sim-006", nombre: "Jardin Botanico y Zoologico", direccion: "Av. Artigas y Primer Presidente", ciudad: "Asuncion" },
  { id: "sim-007", nombre: "Salto Cristal", direccion: "La Colmena", ciudad: "Paraguari" },
  { id: "sim-008", nombre: "Cerro Koi", direccion: "Areguá", ciudad: "Areguá" },
  { id: "sim-009", nombre: "Lago Ypacarai", direccion: "San Bernardino", ciudad: "Cordillera" },
  { id: "sim-010", nombre: "Saltos del Monday", direccion: "Presidente Franco", ciudad: "Alto Parana" },
  { id: "sim-011", nombre: "Represa de Itaipu", direccion: "Hernandarias", ciudad: "Alto Parana" },
  { id: "sim-012", nombre: "Encarnacion - Playa San Jose", direccion: "Costanera de Encarnacion", ciudad: "Itapua" },
  { id: "sim-013", nombre: "Ruinas Jesuiticas de Trinidad", direccion: "Trinidad", ciudad: "Itapua" },
  { id: "sim-014", nombre: "Chaco Paraguayo - Fortin Toledo", direccion: "Mariscal Estigarribia", ciudad: "Boqueron" },
  { id: "sim-015", nombre: "Aeropuerto Silvio Pettirossi", direccion: "Autopista Nac. Silvio Pettirossi", ciudad: "Luque" },
];

class BuscadorSimulado implements BuscadorUbicaciones {
  async buscar(consulta: string): Promise<Ubicacion[]> {
    const termino = normalizar(consulta.trim());
    if (termino.length < 2) return [];

    return SIMULADAS.filter(
      (u) =>
        normalizar(u.nombre).includes(termino) ||
        normalizar(u.ciudad).includes(termino),
    ).slice(0, 8);
  }
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

let instancia: BuscadorUbicaciones | null = null;

export function buscadorUbicaciones(): BuscadorUbicaciones {
  if (!instancia) instancia = new BuscadorSimulado();
  return instancia;
}
