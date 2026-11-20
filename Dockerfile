# syntax=docker/dockerfile:1
# The web app's image. Railway builds it (railway.json); nothing here is host-specific.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_ values are written into the browser's code at build time, so the
# host passes them as build arguments. Secrets are never build arguments.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_MEDORA_ENV
ENV NEXT_TELEMETRY_DISABLED=1
# The deploy writes the commit to release-sha.txt before uploading; next.config.ts
# bakes it in so /api/health can say which commit is live (ADR 0024).
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# The standalone server carries only the dependencies it uses.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Exec'd directly so SIGTERM reaches node.
CMD ["node", "server.js"]
