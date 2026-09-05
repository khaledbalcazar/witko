# Publicaciones

Plataforma interna del equipo de marketing para cargar, revisar, aprobar y
programar publicaciones de Instagram, Facebook y TikTok, para las marcas
**Witko** y **Palma Travel**.

Nada se publica sin la aprobación de un jefe. La zona horaria de operación es
`America/Asuncion` y la interfaz está en español.

## Cómo funciona

- **CM** carga la publicación, arma el contenido y propone fecha y hora.
- **Jefe** revisa, aprueba o devuelve con comentarios.
- **Admin** gestiona usuarios, marcas y conexiones de cuentas.

Un post aprobado que se edita vuelve a borrador: no se aprueba una cosa y se
publica otra.

## Estado

**Fase 0.** El circuito completo funciona contra un adaptador simulado: no se
llama a ninguna API real. Es a propósito — el App Review de Meta y la auditoría
de TikTok tardan semanas, y el equipo puede usar el flujo de aprobación desde
ya, publicando a mano mientras tanto.

| Fase | Alcance | Estado |
|---|---|---|
| 0 | Esquema, roles, carga, aprobación, calendario, tablero, worker simulado | Listo |
| 1 | OAuth de Meta, adaptadores de Instagram y Facebook, cuota | Pendiente |
| 2 | TikTok, empezando en modo inbox | Pendiente |
| 3 | Métricas, biblioteca de assets, plantillas | Pendiente |

## Arquitectura

Next.js 15 (App Router) · TypeScript · Tailwind · shadcn/ui sobre Base UI ·
Supabase (Postgres, Auth, Storage) · Drizzle ORM · Zod · Vitest.

Dos procesos:

- **La app** (`app/`), que se despliega en Vercel.
- **El worker** (`worker/`), un proceso Node aparte que publica en el momento
  exacto. **No va en Vercel**: necesita estar siempre prendido y las funciones
  serverless se apagan entre requests.

Instagram no tiene programación por API y TikTok tampoco, así que el post
programado vive en nuestra base y el worker lo publica. Hace polling sobre
Postgres con `FOR UPDATE SKIP LOCKED`, sin Redis ni colas externas.

El porqué de cada decisión está en [DECISIONES.md](DECISIONES.md).

## Arrancar

Los pasos de configuración externa (crear el proyecto de Supabase, pedir
permisos a Meta, verificar el dominio en TikTok) están en
[SETUP.md](SETUP.md). Resumido:

```bash
npm install
cp .env.example .env.local   # completar con los datos de Supabase
cp .env.local .env
npm run db:migrate
npm run db:seed
npm run crear-admin -- "Nombre Apellido" correo@empresa.com
```

Después, en dos terminales:

```bash
npm run dev
```

```bash
npm run dev:worker
```

## Comandos

| Comando | Para qué |
|---|---|
| `npm run dev` / `dev:worker` | App y worker en desarrollo |
| `npm test` | Tests de la máquina de estados, validaciones y adaptadores |
| `npm run db:generate` / `db:migrate` | Migraciones versionadas |
| `npm run db:seed` | Crea las marcas y sus tableros |
| `npm run crear-admin` | Primer usuario administrador |
| `npm run listar-usuarios` | Usuarios, roles y marcas |
| `npm run resetear-password` | Genera una contraseña nueva |

## Seguridad

Los tokens de las plataformas se guardan cifrados con AES-256-GCM y nunca
llegan al navegador. Todas las llamadas a APIs externas ocurren en el servidor
o en el worker. Cada transición de estado y cada edición quedan en `audit_log`.

Nunca commitear `.env` ni `.env.local`.
