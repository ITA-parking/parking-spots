FROM node:24-alpine
RUN apt-get update && apt-get install -y ca-certificates curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
EXPOSE 7010
ENV PORT=7010
CMD ["node", "src/index.js"]
