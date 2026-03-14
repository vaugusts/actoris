FROM node:22-bookworm-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS build
COPY . .
RUN npm run build

FROM base AS runtime
WORKDIR /app
COPY . .
COPY --from=build /app/dist ./dist
ENV TEST_ENV=local
CMD ["npm", "run", "test:all"]
