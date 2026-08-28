FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl poppler-utils postgresql-client \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN cp prisma/schema.postgres.prisma prisma/schema.prisma \
  && npx prisma generate \
  && npm run build

COPY docker-entrypoint.sh /usr/local/bin/relo-backend-entrypoint
RUN chmod +x /usr/local/bin/relo-backend-entrypoint

EXPOSE 4000
ENTRYPOINT ["relo-backend-entrypoint"]
