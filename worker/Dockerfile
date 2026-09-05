# Worker de publicacion. Va en un servicio que este siempre prendido
# (Railway, Fly.io, un VPS), no en Vercel.
FROM node:24-alpine

WORKDIR /app

# Las dependencias se instalan aparte del codigo para aprovechar la cache de
# capas: cambiar un .ts no obliga a reinstalar node_modules.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install tsx

# El worker comparte lib/ y db/ con la app: se copian los tres.
COPY tsconfig.json ./
COPY db ./db
COPY lib ./lib
COPY worker ./worker

ENV NODE_ENV=production

# Se corre con tsx en vez de compilar: son pocos archivos y evita mantener una
# configuracion de build separada de la de Next.
CMD ["npx", "tsx", "worker/index.ts"]
