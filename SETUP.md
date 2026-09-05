# Configuración

Todo lo que hay que hacer a mano, en orden. Lo marcado **[Fase 0]** hace falta
para que la app corra hoy; el resto se hace cuando toque cada fase.

---

## 1. Requisitos locales **[Fase 0]**

- Node.js 20 o superior (probado con 24.18)
- npm 10 o superior
- Git

```bash
npm install
```

---

## 2. Proyecto de Supabase **[Fase 0]**

1. Crear un proyecto en <https://supabase.com/dashboard> (región recomendada:
   `us-east-1`, la más cercana con menor latencia desde Paraguay).
2. Anotar la contraseña de la base que aparece al crearlo: no se vuelve a
   mostrar.
3. En **Project Settings → API Keys**, copiar:
   - `Publishable key` (`sb_publishable_...`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `Secret key` (`sb_secret_...`, se revela con el botón del ojo) →
     `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS: solo va en el servidor y en el
     worker, nunca en el navegador)

   > Supabase renombró las claves. La *publishable* es la que antes se llamaba
   > `anon` y la *secret* la que antes era `service_role`. Los nombres de las
   > variables se mantienen; sirven las dos generaciones de claves.

4. Del botón verde **Connect** (arriba del panel), copiar:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `Connection string → URI` → `DATABASE_URL`, reemplazando
     `[YOUR-PASSWORD]` por la contraseña de la base del paso 2.

---

## 3. Bucket de medios **[Fase 0]**

En **Storage → New bucket**:

- Nombre: `medios`
- **Public bucket: activado**

> El bucket tiene que ser público porque al publicar, Meta hace un `cURL` al
> archivo desde sus propios servidores. Si la URL requiere autenticación, la
> publicación falla. No subir a este bucket nada que no sea material que va a
> ser público de todos modos.

---

## 4. Variables de entorno **[Fase 0]**

```bash
cp .env.example .env.local   # la app Next
cp .env.example .env         # el worker y drizzle-kit
```

Generar la clave de cifrado de tokens:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Pegarla en `TOKEN_ENCRYPTION_KEY` en ambos archivos. **Tiene que ser la misma en
la app y en el worker**, o el worker no va a poder descifrar los tokens que
guardó la app. Si se pierde, hay que reconectar todas las cuentas sociales.

---

## 5. Migraciones y datos iniciales **[Fase 0]**

```bash
npm run db:generate   # genera el SQL a partir de db/schema.ts
npm run db:migrate    # lo aplica
npm run db:seed       # crea las marcas Witko y Palma Travel con sus tableros
```

---

## 6. Primer usuario administrador **[Fase 0]**

Supabase no permite crear usuarios con contraseña desde el SQL editor, así que
el primero se crea a mano:

1. **Authentication → Users → Add user → Create new user**
2. Email y contraseña del admin. Marcar **Auto Confirm User**.
3. Copiar el UUID del usuario recién creado.
4. Correr en el **SQL Editor**, reemplazando el UUID y los datos:

```sql
insert into users (id, nombre, email, rol)
values ('UUID-COPIADO', 'Nombre Apellido', 'admin@empresa.com', 'ADMIN');

insert into brand_members (brand_id, user_id, rol)
select id, 'UUID-COPIADO', 'ADMIN' from brands;
```

Desde ahí, el resto de los usuarios se invitan desde `/admin/usuarios` dentro de
la app: se elige nombre, correo, rol y marcas, y la app devuelve una **contraseña
temporal que se muestra una sola vez**. Hay que pasársela a la persona por el
canal que usen habitualmente y pedirle que la cambie al entrar. No se manda por
correo porque todavía no hay dominio verificado para enviar (ver paso 10).

### Cuentas sociales de prueba

En `/admin/cuentas` se cargan a mano las cuentas de cada marca (nombre visible e
identificador). Con `USE_MOCK_ADAPTERS=1` no hacen falta credenciales reales:
alcanza para recorrer todo el circuito de carga, aprobación, programación y
"publicación" simulada. Cuando estén aprobadas las apps, esas mismas filas se
completan con los tokens reales desde el flujo OAuth.

---

## 7. Correr la app **[Fase 0]**

Dos terminales:

```bash
npm run dev
```

```bash
npm run dev:worker
```

La app queda en <http://localhost:3000>. Con `USE_MOCK_ADAPTERS=1` el worker
simula la publicación: marca los posts como publicados con un permalink falso,
sin llamar a ninguna API. Para probar los reintentos, subir `MOCK_TASA_FALLO` a
`0.5` y reiniciar el worker.

---

## 8. App de Meta **[Fase 1]**

Nada de esto se puede automatizar: hay que hacerlo desde el panel de Meta y la
revisión tarda semanas.

1. **Business Manager.** Crear uno en <https://business.facebook.com> (o usar el
   existente de la empresa) y agregar ahí las Páginas de Facebook y las cuentas
   de Instagram de **Witko** y de **Palma Travel**.
2. **Cuentas de Instagram.** Cada una tiene que ser **Business** (no Creator, no
   personal) y estar vinculada a su Página de Facebook. Se hace desde la app de
   Instagram: Configuración → Cuenta → Cambiar a cuenta profesional.
3. **App.** En <https://developers.facebook.com/apps> crear una app tipo
   **Business**. Copiar `App ID` y `App Secret` a `META_APP_ID` y
   `META_APP_SECRET`.
4. **Productos.** Agregar *Instagram Graph API* y *Facebook Login for Business*.
5. **Permisos a pedir en App Review:**
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `business_management`
   - `instagram_manage_comments` (para el primer comentario)
   - `pages_manage_engagement` (para el primer comentario en Facebook)

   La revisión pide un video mostrando el flujo completo dentro de la app y una
   explicación de por qué se necesita cada permiso. Conviene grabarlo con la app
   ya funcionando en Fase 0.
6. **Verificación del negocio.** Meta la exige antes de aprobar
   `instagram_content_publish`. Pide documentación de la empresa (RUC, factura
   de servicios a nombre de la empresa, etc.) y tarda entre días y semanas.
7. **Token.** Preferir un **System User token** de Business Manager antes que un
   user token de larga duración:
   - Business Settings → Users → System Users → Add
   - Asignar la Página y la cuenta de Instagram con permiso de control total
   - Generate New Token, con los permisos de arriba

   El System User token no expira, mientras que el de usuario vence a los 60
   días y obliga a reconectar. Pegarlo en `/admin/cuentas` de la app.
8. **Webhooks (opcional).** Callback URL:
   `https://TU-DOMINIO/api/webhooks/meta`, con `META_WEBHOOK_VERIFY_TOKEN`
   igual al valor del `.env`. La app valida la firma `X-Hub-Signature-256`.

---

## 9. App de TikTok **[Fase 2]**

1. Crear la app en <https://developers.tiktok.com>. Copiar `Client key` y
   `Client secret` a `TIKTOK_CLIENT_KEY` y `TIKTOK_CLIENT_SECRET`.
2. Agregar el producto **Content Posting API** y pedir los scopes
   `video.publish`, `video.upload` y `user.info.basic`.
3. **Auditoría de contenido.** Es un trámite **aparte** del App Review normal.
   Hasta que se apruebe, todo lo que publique la app queda **en privado**, sin
   importar la configuración. Por eso el sistema arranca en modo
   `MEDIA_UPLOAD`: el video llega al inbox del creador y él termina de
   publicarlo desde la app de TikTok, que no tiene esa restricción.
4. **`DIRECT_POST`** se habilita por marca desde `/admin/marcas` recién cuando la
   auditoría esté aprobada.
5. **Verificación de dominio.** Solo si se quiere usar `PULL_FROM_URL` (que
   TikTok descargue el video desde nuestro Storage). Se hace en el portal, en
   *URL properties*, con un registro TXT en el DNS. Mientras no esté, el
   adaptador usa `FILE_UPLOAD` y sube el archivo por partes desde el worker.

---

## 10. Envío de emails **[Fase 1]**

1. Cuenta en <https://resend.com>, agregar el dominio de la empresa y cargar los
   registros DNS (SPF, DKIM) que indica el panel.
2. Copiar la API key a `RESEND_API_KEY` y ajustar `RESEND_FROM`.
3. Cambiar `NOTIFIER=console` por `NOTIFIER=resend`.

---

## 11. Despliegue

- **App:** Vercel, importando el repo. Cargar todas las variables de entorno del
  `.env.local` en el proyecto.
- **Worker:** *no* va en Vercel. Es un proceso que tiene que estar siempre
  prendido; las funciones serverless se apagan entre requests. Va en Railway,
  Fly.io o un VPS chico, con el `Dockerfile` de `worker/`. Necesita
  `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY` y las
  credenciales de las plataformas.
- Correr **un solo** worker es suficiente. Si se corren varios, el
  `SKIP LOCKED` evita que se pisen, pero cada uno necesita un `WORKER_ID`
  distinto.
