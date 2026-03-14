FROM node:22-bookworm-slim AS base

WORKDIR /workspace

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

ENV TEST_ENV=local
ENV MOCK_PORT=3100

CMD ["npm", "test"]
