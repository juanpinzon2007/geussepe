FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
# Con NODE_ENV=production, npm ci omite devDependencies y no existe `ng` (@angular/cli) → exit 127.
RUN npm ci --include=dev

COPY . .
RUN npm run build:prod

FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/frontend/browser ./

EXPOSE 80
