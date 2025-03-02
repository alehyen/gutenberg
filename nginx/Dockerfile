# Stage 1: Build Frontend
FROM node:20 AS frontend-build

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm install

COPY frontend ./

# Inject API_HOST_URL at build time
ARG API_HOST_URL
ENV VITE_API_HOST_URL=${API_HOST_URL}

RUN npm run build

# Stage 2: Setup Nginx
FROM nginx:alpine

# Copy the built frontend files to Nginx's HTML directory
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
