# Stage 1: Build the Vite SPA
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency definitions and install
COPY package*.json ./
RUN npm ci

# Copy the source code and build
COPY . .
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy the built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy the Nginx configuration template
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Cloud Run automatically sets the PORT environment variable.
# We set a default of 8080 in case it is run locally.
ENV PORT 8080

EXPOSE 8080

# The standard nginx:alpine entrypoint automatically substitutes ${PORT} 
# in the template and outputs it to /etc/nginx/conf.d/default.conf
CMD ["nginx", "-g", "daemon off;"]