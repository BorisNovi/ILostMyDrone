FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json .
COPY scripts ./scripts
COPY public ./public
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

COPY --from=build --chown=node /app/dist ./dist

USER node

EXPOSE 4200

CMD ["node", "dist/frontend/server/server.mjs"]
