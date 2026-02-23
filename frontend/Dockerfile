FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

# Mantemos servidor Vite em modo dev no compose local para respeitar VITE_API_URL em runtime.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
