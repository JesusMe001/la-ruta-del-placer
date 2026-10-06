FROM node:20-slim AS builder
WORKDIR /app
# openssl: lo necesita Prisma. unixodbc-dev + build-essential + python3: hacen
# falta para compilar el addon nativo del paquete "odbc" (npm install).
RUN apt-get update -y && apt-get install -y openssl unixodbc-dev build-essential python3 && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
# unixodbc (sin -dev): la libreria de runtime que usa el addon "odbc" ya compilado.
# El driver real de Informix (IBM Client SDK) NO se puede empaquetar aqui por
# licencia — hay que instalarlo aparte en el servidor y montarlo/copiarlo,
# ver README.md sección "Integración con Informix".
RUN apt-get update -y && apt-get install -y openssl unixodbc && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["node", "dist/main"]
