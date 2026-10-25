# syntax=docker/dockerfile:1

# 1. Install every dependency and build the web app.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY contracts/package.json contracts/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --ignore-scripts
COPY tsconfig.base.json ./
COPY contracts contracts
COPY web web
RUN npm run build

# 2. Production dependencies of the server only.
FROM node:24-slim AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY contracts/package.json contracts/
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev --workspace=server --include-workspace-root=false --ignore-scripts

# 3. Runtime: server source (run with tsx), contracts and the built web app.
FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/salary.db \
    SEED_ON_EMPTY=true \
    WEB_DIST_PATH=/app/web/dist
WORKDIR /app/server
COPY --from=production-deps /app/node_modules /app/node_modules
COPY package.json /app/package.json
COPY contracts /app/contracts
COPY server /app/server
COPY --from=build /app/web/dist /app/web/dist
RUN mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["npm", "run", "start"]
