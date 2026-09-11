# -------- Этап 1: сборка React --------
FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# -------- Этап 2: Nginx --------
FROM nginx:alpine

# Копируем собранную статику
COPY --from=builder /app/dist /usr/share/nginx/html

# Свой конфиг nginx с проксированием /api на бэкенд
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]