# Guildhall's container image. The vault is mounted read-only at /vault and Guildhall's own data
# at /data; see docker-compose.yml and docs/deployment.md.

# --- Build: install everything, build the app, then drop the development-only packages. ---
FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# --- Run: only what the server needs, as an unprivileged user. ---
FROM node:26-slim
ENV NODE_ENV=production \
    PORT=3000 \
    VAULT_PATH=/vault \
    DATA_PATH=/data
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/server.js ./
# A new named volume copies this folder's owner, so the data volume starts out writable.
RUN mkdir -p /vault /data && chown node:node /data
USER node
EXPOSE 3000
# The slim image has no curl; Node's own fetch does the check.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# Not `npm start`: that needs cross-env, a development package.
CMD ["node", "server.js"]
