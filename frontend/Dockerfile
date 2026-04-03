FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build
EXPOSE 4173
CMD ["npm", "run", "preview"]