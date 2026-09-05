# Decisiones de arquitectura

Cada entrada dice qué se decidió y por qué. Si algo se revierte, se agrega una
entrada nueva en vez de borrar la vieja.

---

## 1. El post programado vive en nuestra base, no en la plataforma

**Decisión.** Ninguna publicación se delega al programador de la plataforma,
aunque exista (`scheduled_publish_time` de Facebook). Un worker propio publica
en el momento exacto.

**Por qué.** Instagram no tiene programación por API: publicar son dos pasos
(`POST /<IG_ID>/media` para crear el container y `POST /<IG_ID>/media_publish`
para publicarlo) y el container expira a las 24 horas. TikTok tampoco programa.
Si Facebook fuera el único que programa del lado de la plataforma, el calendario
dejaría de ser una sola fuente de verdad: habría posts que se pueden cancelar
desde la app y otros que no. Un solo mecanismo para las tres plataformas.

**Consecuencia.** El container de Instagram se crea recién en el momento de
publicar, nunca por adelantado.

---

## 2. El post se separa de sus destinos

**Decisión.** `posts` guarda lo común y `post_targets` guarda una fila por
cuenta social, con su propio caption, su propio estado, su propio
`external_media_id` y su propio error.

**Por qué.** Un post que va a Instagram y Facebook puede publicar bien en una y
fallar en la otra. Con un solo estado no habría forma de reintentar únicamente
la que falló, y el caption tiene límites y convenciones distintos por plataforma.

---

## 3. `scheduled_at` está en `posts`, no en `post_targets`

**Decisión.** Un post multi-destino publica a la misma hora en todas sus
plataformas.

**Por qué.** Es lo que pide el flujo actual del equipo y mantiene el calendario
legible: una tarjeta, un horario. Si más adelante hace falta desfasar destinos,
la columna se mueve a `post_targets` y el calendario agrupa por post.

---

## 4. `version` en `posts`

**Decisión.** Editar el contenido de un post que ya estaba en `EN_REVISION`,
`APROBADO`, `PROGRAMADO` o `FALLIDO` lo devuelve a `BORRADOR` e incrementa
`version`. `approvals` guarda la versión que se revisó.

**Por qué.** La regla dura del proyecto es que no se aprueba una cosa y se
publica otra. Sin un número de versión, el registro de aprobación no prueba
sobre qué contenido se dio. Con él, el historial muestra "el jefe aprobó la
versión 2" aunque hoy el post vaya por la 4.

---

## 5. `external_container_id` en `post_targets`

**Decisión.** Se guarda el id del container de Instagram apenas se crea, antes
de publicarlo.

**Por qué.** La publicación en Instagram tiene dos llamadas. Si el worker muere
entre las dos, sin esta columna el reintento crearía un container nuevo y podría
terminar publicando dos veces. Guardándolo, el reintento retoma el container que
ya existe (o lo descarta si pasaron las 24 horas de expiración).

---

## 6. Idempotencia en dos niveles

**Decisión.** (a) Antes de publicar, el worker verifica que el `post_target` no
tenga ya `external_media_id`; si lo tiene, cierra el job en OK sin llamar a la
API. (b) Un índice único parcial en `publish_jobs` impide dos jobs activos
(`PENDIENTE` o `EN_CURSO`) para el mismo destino.

**Por qué.** Publicar dos veces en la cuenta de un cliente es el peor error
posible del sistema y no se puede deshacer. La verificación en código cubre el
reinicio del worker; el índice cubre un bug de encolado.

---

## 7. Polling sobre Postgres, sin Redis ni colas externas

**Decisión.** El worker hace `SELECT ... FOR UPDATE SKIP LOCKED` cada 30
segundos sobre `publish_jobs`.

**Por qué.** El volumen es el de un equipo de marketing de dos marcas: decenas
de posts por semana, no miles por minuto. `SKIP LOCKED` da exclusión mutua real
entre varios workers sin infraestructura adicional. Agregar Redis sumaría una
pieza más para monitorear sin resolver ningún problema que exista hoy.

---

## 8. Máquina de estados aislada y pura

**Decisión.** `lib/workflow/state-machine.ts` es una función pura: recibe el
estado, la acción, el actor, la marca y la hora, y devuelve el resultado. No
toca la base ni el reloj. `lib/workflow/apply.ts` es el único que persiste, y
siempre escribe `audit_log` en la misma transacción.

**Por qué.** Hace el flujo de aprobación testeable sin base de datos (49 tests
corren en 3 segundos) y garantiza que ningún componente ni route handler pueda
escribir `estado` a mano y saltearse una regla.

---

## 9. Editar un post `PROGRAMADO` también lo baja a `BORRADOR`

**Decisión.** El pedido original solo nombraba `EN_REVISION` y `APROBADO`. Se
extendió a `PROGRAMADO` y `FALLIDO`, cancelando además los jobs en cola.

**Por qué.** Si no, editar un post ya programado publicaría contenido que nadie
aprobó, que es exactamente lo que la regla busca evitar. `FALLIDO` va en el
mismo grupo porque el reintento republica el contenido tal como esté.

---

## 10. Enviar a revisión es solo del autor

**Decisión.** `ENVIAR_A_REVISION` exige ser el autor del post, sin importar el
rol. Un jefe no puede empujar a revisión el borrador de otro.

**Por qué.** Es lo que dice la tabla del pedido ("CM (autor)") y evita que un
borrador a medio hacer entre a la bandeja de aprobación sin que su autor lo dé
por terminado.

---

## 11. Aprueba cualquier `JEFE` de la marca

**Decisión.** No hay aprobador nominado por post: cualquier miembro con rol
`JEFE` (o `ADMIN`) de esa marca puede aprobar o devolver.

**Por qué.** Con dos marcas y pocos usuarios, un aprobador fijo solo agrega un
punto de bloqueo cuando esa persona está de vacaciones. `approvals` deja
registrado quién aprobó, que es lo que importa para la trazabilidad.

---

## 12. Next 15 en vez de 16

**Decisión.** `create-next-app@latest` instaló Next 16.3.4; se fijó a 15.5.x.

**Por qué.** El stack pedido dice Next 15 explícitamente. La migración a 16 es
un cambio acotado (App Router en ambas) y se puede hacer cuando se quiera.

---

## 13. `feed_targeting` de Facebook queda apagado

**Decisión.** El campo existe en `post_targets.config` pero la UI no lo muestra
en Fase 0.

**Por qué.** Meta discontinuó el targeting orgánico por intereses en Páginas. Lo
que queda son campos demográficos y de ubicación/idioma, con disponibilidad
variable por Página. Mostrar un control que casi no segmenta es peor que no
mostrarlo. En Fase 1, con la API real, se confirma qué acepta cada Página antes
de habilitarlo.

---

## 14. La duración máxima de TikTok no es un número fijo

**Decisión.** El límite se lee de `max_video_post_duration_sec` que devuelve
`creator_info/query`, no de un valor constante.

**Por qué.** El tope varía por creador y por cuenta. Un límite fijo de 10
minutos rechazaría videos válidos para unos y aceptaría inválidos para otros.
En Fase 0, sin API, el mock devuelve 600 segundos como valor por defecto.

---

## 15. Buscador de ubicaciones detrás de un adaptador

**Decisión.** La búsqueda de ubicaciones usa una interfaz propia; en Fase 0 la
implementa un buscador con datos fijos de Asunción y alrededores.

**Por qué.** La Pages Search API de Meta requiere App Review y sus propios
permisos, que tardan semanas. La regla de no aceptar texto libre (solo Páginas
con dirección física, con `location_id`) se respeta desde el día uno, así que
cambiar el adaptador en Fase 1 no cambia ni la UI ni los datos guardados.

---

## 16. Notificaciones por consola en Fase 0

**Decisión.** `Notifier` es una interfaz; en Fase 0 la implementación imprime en
consola y en Fase 1 se cambia por Resend.

**Por qué.** Resend necesita un dominio verificado que todavía no existe. El
flujo de aprobación no puede quedar bloqueado esperando un registro DNS.

---

## 17. El tablero de tareas es propio, no un Trello embebido

**Decisión.** Tablero kanban dentro de la app (`boards`, `board_columns`,
`board_cards`), con columnas y etiquetas personalizables por marca, y con la
tarjeta pudiendo apuntar a un `post_id`.

**Por qué.** El valor está en que la tarea "reel de promo de agosto" y la
publicación que la cumple sean la misma cosa mirada desde dos lados: el tablero
muestra el estado real del post sin que nadie tenga que sincronizar dos
herramientas a mano. Con Trello embebido eso no se puede.

**Detalle.** El orden de columnas y tarjetas es `double precision`, no entero:
al arrastrar se calcula el punto medio entre vecinos y se actualiza una sola
fila, en vez de renumerar la columna entera.

---

## 18. Alta de usuarios con contraseña temporal

**Decisión.** El admin crea el usuario desde `/admin/usuarios` y la app genera
una contraseña aleatoria que se muestra una sola vez, en pantalla.

**Por qué.** El pedido es que el admin cree e invite y que la gente entre con
correo y contraseña. La invitación por email de Supabase necesita un dominio de
envío verificado, que todavía no existe (misma razón que el Notifier de
consola). Mostrarla una vez y pedir que se cambie es lo que se puede sostener
hoy sin bloquear el alta del equipo.

**Cuándo cambia.** En Fase 1, con Resend andando, se reemplaza por un enlace de
invitación por correo y la contraseña temporal desaparece.

---

## 19. La autorización se aplica en el servidor, no en RLS

**Decisión.** La app y el worker se conectan con un rol que bypassa RLS. Quién
puede hacer qué lo decide la máquina de estados y las server actions, que
siempre verifican que el recurso pertenezca a la marca activa del usuario. Las
políticas de RLS existen igual, como segunda red.

**Por qué.** Repartir la autorización entre RLS y el código lleva a que nadie
sepa dónde mirar cuando algo se permite o se niega de más. Con una sola fuente
—el código— las reglas están testeadas y son legibles. RLS queda cubriendo el
caso de que algo llegue a la base con el token de un usuario, y protege los
tokens de `social_accounts`, que no tienen ninguna política de lectura.

---

## 20. shadcn/ui sobre Base UI

**Decisión.** La versión actual de shadcn/ui genera componentes sobre Base UI,
no sobre Radix. Se usan sus convenciones: `render={<Link />}` en lugar de
`asChild`, y los `onValueChange` de `Select` pueden devolver `null`.

**Por qué.** Es lo que instala el CLI hoy. Forzar la variante de Radix
significaría quedarse en una versión vieja del generador. Los logos de marca
también salieron de `lucide-react` en su versión 1, así que los íconos de
Instagram, Facebook y TikTok van dibujados en `components/iconos-redes.tsx`.
