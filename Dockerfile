FROM node:24.13.0-bookworm-slim@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f AS dependencies
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run build

FROM node:24.13.0-bookworm-slim@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f AS production-dependencies
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

FROM node:24.13.0-bookworm-slim@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f AS runtime
ARG REVISION=unknown
ARG VERSION=dev
LABEL org.opencontainers.image.title="Mantooth Tasks" \
      org.opencontainers.image.description="A compact single-user daily task planner" \
      org.opencontainers.image.source="https://github.com/jmansmann/mantooth-tasks" \
      org.opencontainers.image.revision="${REVISION}" \
      org.opencontainers.image.version="${VERSION}"
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    HOME=/tmp
WORKDIR /app
COPY --from=production-dependencies --chown=10001:10001 /app/node_modules ./node_modules
COPY --from=build --chown=10001:10001 /app/dist ./dist
COPY --chown=10001:10001 package.json ./package.json
USER 10001:10001
EXPOSE 8080
CMD ["node", "dist/server/apps/server/index.js"]
