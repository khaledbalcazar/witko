import { describe, expect, it } from "vitest";
import { evaluarTransicion } from "@/lib/workflow/state-machine";
import {
  ACTOR_SISTEMA,
  type Actor,
  type EntradaTransicion,
  type EstadoPost,
  type MarcaSnapshot,
  type PostSnapshot,
  type Rol,
} from "@/lib/workflow/types";

const AHORA = new Date("2026-03-10T14:00:00Z");
const EN_UNA_HORA = new Date("2026-03-10T15:00:00Z");
const EN_CINCO_MINUTOS = new Date("2026-03-10T14:05:00Z");

const AUTOR_ID = "11111111-1111-1111-1111-111111111111";
const OTRO_ID = "22222222-2222-2222-2222-222222222222";
const BRAND_ID = "33333333-3333-3333-3333-333333333333";

function usuario(rol: Rol, id = OTRO_ID, esMiembro = true): Actor {
  return { tipo: "USUARIO", id, rol, esMiembro };
}

const cm = usuario("CM", AUTOR_ID);
const otroCm = usuario("CM", OTRO_ID);
const jefe = usuario("JEFE", OTRO_ID);
const admin = usuario("ADMIN", OTRO_ID);

function post(estado: EstadoPost, extra: Partial<PostSnapshot> = {}): PostSnapshot {
  return {
    id: "44444444-4444-4444-4444-444444444444",
    estado,
    autorId: AUTOR_ID,
    brandId: BRAND_ID,
    version: 1,
    scheduledAt: null,
    archivadoAt: null,
    ...extra,
  };
}

const marca: MarcaSnapshot = {
  id: BRAND_ID,
  permitirAutoAprobacion: false,
};

function entrada(over: Partial<EntradaTransicion> & Pick<EntradaTransicion, "accion" | "post" | "actor">): EntradaTransicion {
  return { marca, ahora: AHORA, ...over };
}

function evaluar(over: Partial<EntradaTransicion> & Pick<EntradaTransicion, "accion" | "post" | "actor">) {
  return evaluarTransicion(entrada(over));
}

/* ------------------------------------------------------------------ */

describe("camino feliz", () => {
  it("el CM autor envia su borrador a revision", () => {
    const r = evaluar({ accion: "ENVIAR_A_REVISION", post: post("BORRADOR"), actor: cm });
    expect(r).toMatchObject({ ok: true, nuevoEstado: "EN_REVISION" });
  });

  it("el jefe aprueba un post en revision y queda registrado", () => {
    const r = evaluar({ accion: "APROBAR", post: post("EN_REVISION"), actor: jefe });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevoEstado).toBe("APROBADO");
    expect(r.efectos.registrarAprobacion).toBe("APROBAR");
    expect(r.efectos.notificarAutor).toBe(true);
  });

  it("el jefe devuelve el post con comentario", () => {
    const r = evaluar({
      accion: "SOLICITAR_CAMBIOS",
      post: post("EN_REVISION"),
      actor: jefe,
      comentario: "Cambiar la foto principal",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevoEstado).toBe("CAMBIOS_SOLICITADOS");
    expect(r.efectos.registrarAprobacion).toBe("SOLICITAR_CAMBIOS");
  });

  it("desde CAMBIOS_SOLICITADOS el CM reenvia a revision", () => {
    const r = evaluar({ accion: "ENVIAR_A_REVISION", post: post("CAMBIOS_SOLICITADOS"), actor: cm });
    expect(r).toMatchObject({ ok: true, nuevoEstado: "EN_REVISION" });
  });

  it("programar un post aprobado encola los jobs", () => {
    const r = evaluar({
      accion: "PROGRAMAR",
      post: post("APROBADO"),
      actor: cm,
      scheduledAt: EN_UNA_HORA,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevoEstado).toBe("PROGRAMADO");
    expect(r.efectos.encolarJobs).toBe(true);
  });

  it("publicar ahora pasa a PUBLICANDO y encola", () => {
    const r = evaluar({ accion: "PUBLICAR_AHORA", post: post("APROBADO"), actor: jefe });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevoEstado).toBe("PUBLICANDO");
    expect(r.efectos.encolarJobs).toBe(true);
  });

  it("el sistema toma el job de un post programado", () => {
    const r = evaluar({ accion: "TOMAR_JOB", post: post("PROGRAMADO"), actor: ACTOR_SISTEMA });
    expect(r).toMatchObject({ ok: true, nuevoEstado: "PUBLICANDO" });
  });

  it("el sistema marca publicado y sella la fecha", () => {
    const r = evaluar({ accion: "MARCAR_PUBLICADO", post: post("PUBLICANDO"), actor: ACTOR_SISTEMA });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevoEstado).toBe("PUBLICADO");
    expect(r.efectos.sellarPublicacion).toBe(true);
  });

  it("el sistema marca fallido y avisa al autor", () => {
    const r = evaluar({ accion: "MARCAR_FALLIDO", post: post("PUBLICANDO"), actor: ACTOR_SISTEMA });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevoEstado).toBe("FALLIDO");
    expect(r.efectos.notificarAutor).toBe(true);
  });

  it("un post fallido se reintenta y vuelve a PROGRAMADO", () => {
    const r = evaluar({
      accion: "REINTENTAR",
      post: post("FALLIDO"),
      actor: cm,
      scheduledAt: EN_UNA_HORA,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevoEstado).toBe("PROGRAMADO");
    expect(r.efectos.encolarJobs).toBe(true);
  });

  it("cancelar la programacion devuelve a APROBADO y limpia la cola", () => {
    const r = evaluar({
      accion: "CANCELAR_PROGRAMACION",
      post: post("PROGRAMADO", { scheduledAt: EN_UNA_HORA }),
      actor: cm,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevoEstado).toBe("APROBADO");
    expect(r.efectos.cancelarJobs).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe("transiciones invalidas", () => {
  it("no se aprueba un borrador", () => {
    const r = evaluar({ accion: "APROBAR", post: post("BORRADOR"), actor: jefe });
    expect(r).toMatchObject({ ok: false, codigo: "TRANSICION_INVALIDA" });
  });

  it("no se programa un post que no fue aprobado", () => {
    const r = evaluar({
      accion: "PROGRAMAR",
      post: post("EN_REVISION"),
      actor: cm,
      scheduledAt: EN_UNA_HORA,
    });
    expect(r).toMatchObject({ ok: false, codigo: "TRANSICION_INVALIDA" });
  });

  it("no se vuelve a enviar a revision algo ya en revision", () => {
    const r = evaluar({ accion: "ENVIAR_A_REVISION", post: post("EN_REVISION"), actor: cm });
    expect(r).toMatchObject({ ok: false, codigo: "TRANSICION_INVALIDA" });
  });

  it("un post publicado no se cancela", () => {
    const r = evaluar({ accion: "CANCELAR", post: post("PUBLICADO"), actor: admin });
    expect(r).toMatchObject({ ok: false, codigo: "TRANSICION_INVALIDA" });
  });
});

/* ------------------------------------------------------------------ */

describe("permisos por rol", () => {
  it("un CM no puede aprobar", () => {
    const r = evaluar({ accion: "APROBAR", post: post("EN_REVISION"), actor: otroCm });
    expect(r).toMatchObject({ ok: false, codigo: "ROL_NO_AUTORIZADO" });
  });

  it("un CM que no es el autor no puede enviar a revision", () => {
    const r = evaluar({ accion: "ENVIAR_A_REVISION", post: post("BORRADOR"), actor: otroCm });
    expect(r).toMatchObject({ ok: false, codigo: "NO_ES_AUTOR" });
  });

  it("un jefe tampoco envia a revision un post ajeno: eso es del autor", () => {
    const r = evaluar({ accion: "ENVIAR_A_REVISION", post: post("BORRADOR"), actor: jefe });
    expect(r).toMatchObject({ ok: false, codigo: "NO_ES_AUTOR" });
  });

  it("quien no es miembro de la marca no puede hacer nada", () => {
    const forastero = usuario("JEFE", OTRO_ID, false);
    const r = evaluar({ accion: "APROBAR", post: post("EN_REVISION"), actor: forastero });
    expect(r).toMatchObject({ ok: false, codigo: "NO_ES_MIEMBRO" });
  });

  it("un CM no puede cancelar el post", () => {
    const r = evaluar({ accion: "CANCELAR", post: post("APROBADO"), actor: cm });
    expect(r).toMatchObject({ ok: false, codigo: "ROL_NO_AUTORIZADO" });
  });

  it("el admin si puede cancelar", () => {
    const r = evaluar({ accion: "CANCELAR", post: post("APROBADO"), actor: admin });
    expect(r).toMatchObject({ ok: true, nuevoEstado: "CANCELADO" });
  });

  it("un usuario no puede tomar un job: eso es del sistema", () => {
    const r = evaluar({ accion: "TOMAR_JOB", post: post("PROGRAMADO"), actor: admin });
    expect(r).toMatchObject({ ok: false, codigo: "ROL_NO_AUTORIZADO" });
  });

  it("el sistema no puede aprobar en lugar del jefe", () => {
    const r = evaluar({ accion: "APROBAR", post: post("EN_REVISION"), actor: ACTOR_SISTEMA });
    expect(r).toMatchObject({ ok: false, codigo: "ROL_NO_AUTORIZADO" });
  });
});

/* ------------------------------------------------------------------ */

describe("auto aprobacion", () => {
  const jefeAutor = usuario("JEFE", AUTOR_ID);

  it("el jefe no aprueba su propio post cuando la marca no lo permite", () => {
    const r = evaluar({ accion: "APROBAR", post: post("EN_REVISION"), actor: jefeAutor });
    expect(r).toMatchObject({ ok: false, codigo: "AUTO_APROBACION_PROHIBIDA" });
  });

  it("si la marca lo permite, si puede", () => {
    const r = evaluar({
      accion: "APROBAR",
      post: post("EN_REVISION"),
      actor: jefeAutor,
      marca: { ...marca, permitirAutoAprobacion: true },
    });
    expect(r).toMatchObject({ ok: true, nuevoEstado: "APROBADO" });
  });

  it("la restriccion tambien aplica a solicitar cambios sobre el propio post", () => {
    const r = evaluar({
      accion: "SOLICITAR_CAMBIOS",
      post: post("EN_REVISION"),
      actor: jefeAutor,
      comentario: "me arrepenti",
    });
    expect(r).toMatchObject({ ok: false, codigo: "AUTO_APROBACION_PROHIBIDA" });
  });
});

/* ------------------------------------------------------------------ */

describe("reglas de datos", () => {
  it("solicitar cambios exige comentario", () => {
    const r = evaluar({ accion: "SOLICITAR_CAMBIOS", post: post("EN_REVISION"), actor: jefe });
    expect(r).toMatchObject({ ok: false, codigo: "COMENTARIO_REQUERIDO" });
  });

  it("un comentario en blanco no cuenta", () => {
    const r = evaluar({
      accion: "SOLICITAR_CAMBIOS",
      post: post("EN_REVISION"),
      actor: jefe,
      comentario: "   ",
    });
    expect(r).toMatchObject({ ok: false, codigo: "COMENTARIO_REQUERIDO" });
  });

  it("programar exige fecha", () => {
    const r = evaluar({ accion: "PROGRAMAR", post: post("APROBADO"), actor: cm });
    expect(r).toMatchObject({ ok: false, codigo: "FECHA_REQUERIDA" });
  });

  it("programar exige al menos 10 minutos de anticipacion", () => {
    const r = evaluar({
      accion: "PROGRAMAR",
      post: post("APROBADO"),
      actor: cm,
      scheduledAt: EN_CINCO_MINUTOS,
    });
    expect(r).toMatchObject({ ok: false, codigo: "FECHA_MUY_PROXIMA" });
  });

  it("no se programa en el pasado", () => {
    const r = evaluar({
      accion: "PROGRAMAR",
      post: post("APROBADO"),
      actor: cm,
      scheduledAt: new Date("2026-03-10T13:00:00Z"),
    });
    expect(r).toMatchObject({ ok: false, codigo: "FECHA_MUY_PROXIMA" });
  });

  it("aprobar con comentario opcional funciona igual", () => {
    const r = evaluar({
      accion: "APROBAR",
      post: post("EN_REVISION"),
      actor: jefe,
      comentario: "Buenisimo",
    });
    expect(r.ok).toBe(true);
  });
});

/* ------------------------------------------------------------------ */

describe("edicion de contenido", () => {
  it("editar un borrador lo deja donde esta", () => {
    const r = evaluar({ accion: "EDITAR_CONTENIDO", post: post("BORRADOR"), actor: cm });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevoEstado).toBe("BORRADOR");
    expect(r.efectos.incrementarVersion).toBe(false);
  });

  it("editar en EN_REVISION devuelve a BORRADOR y sube la version", () => {
    const r = evaluar({ accion: "EDITAR_CONTENIDO", post: post("EN_REVISION"), actor: cm });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevoEstado).toBe("BORRADOR");
    expect(r.efectos.incrementarVersion).toBe(true);
  });

  it("editar un post APROBADO invalida la aprobacion", () => {
    const r = evaluar({ accion: "EDITAR_CONTENIDO", post: post("APROBADO"), actor: cm });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevoEstado).toBe("BORRADOR");
    expect(r.efectos.incrementarVersion).toBe(true);
  });

  it("editar un post PROGRAMADO lo baja a BORRADOR y cancela la cola", () => {
    const r = evaluar({
      accion: "EDITAR_CONTENIDO",
      post: post("PROGRAMADO", { scheduledAt: EN_UNA_HORA }),
      actor: cm,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevoEstado).toBe("BORRADOR");
    expect(r.efectos.cancelarJobs).toBe(true);
  });

  it("un post PUBLICADO es inmutable", () => {
    const r = evaluar({ accion: "EDITAR_CONTENIDO", post: post("PUBLICADO"), actor: admin });
    expect(r).toMatchObject({ ok: false, codigo: "POST_INMUTABLE" });
  });

  it("no se edita mientras se esta publicando", () => {
    const r = evaluar({ accion: "EDITAR_CONTENIDO", post: post("PUBLICANDO"), actor: cm });
    expect(r).toMatchObject({ ok: false, codigo: "POST_INMUTABLE" });
  });

  it("un post archivado no se toca", () => {
    const r = evaluar({
      accion: "EDITAR_CONTENIDO",
      post: post("BORRADOR", { archivadoAt: AHORA }),
      actor: cm,
    });
    expect(r).toMatchObject({ ok: false, codigo: "POST_ARCHIVADO" });
  });
});

/* ------------------------------------------------------------------ */

describe("archivado", () => {
  it("un post publicado se archiva", () => {
    const r = evaluar({ accion: "ARCHIVAR", post: post("PUBLICADO"), actor: jefe });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevoEstado).toBe("PUBLICADO");
    expect(r.efectos.archivar).toBe(true);
  });

  it("un CM no archiva", () => {
    const r = evaluar({ accion: "ARCHIVAR", post: post("PUBLICADO"), actor: cm });
    expect(r).toMatchObject({ ok: false, codigo: "ROL_NO_AUTORIZADO" });
  });
});

/* ------------------------------------------------------------------ */

describe("cancelacion general", () => {
  const cancelables: EstadoPost[] = [
    "BORRADOR",
    "EN_REVISION",
    "CAMBIOS_SOLICITADOS",
    "APROBADO",
    "PROGRAMADO",
    "PUBLICANDO",
    "FALLIDO",
  ];

  it.each(cancelables)("el jefe cancela desde %s", (estado) => {
    const r = evaluar({ accion: "CANCELAR", post: post(estado), actor: jefe });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.nuevoEstado).toBe("CANCELADO");
    expect(r.efectos.cancelarJobs).toBe(true);
  });

  it("no se cancela dos veces", () => {
    const r = evaluar({ accion: "CANCELAR", post: post("CANCELADO"), actor: jefe });
    expect(r).toMatchObject({ ok: false, codigo: "TRANSICION_INVALIDA" });
  });
});
