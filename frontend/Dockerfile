FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
# Railway passes service variables to the build only when they are declared here. NEXT_PUBLIC_ values are written
# into the browser code at build time, so without this the links would point at localhost.
ARG CONNECT_API_URL
ARG NEXT_PUBLIC_CONNECT_APP_URL
ENV CONNECT_API_URL=$CONNECT_API_URL NEXT_PUBLIC_CONNECT_APP_URL=$NEXT_PUBLIC_CONNECT_APP_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
