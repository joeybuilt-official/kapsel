FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

RUN mkdir -p /data/tarballs
VOLUME ["/data"]

ENV PORT=3000
ENV KAPSEL_DB_PATH=/data/registry.db
ENV KAPSEL_TARBALLS_DIR=/data/tarballs

EXPOSE 3000
CMD ["node", "dist/index.js"]
