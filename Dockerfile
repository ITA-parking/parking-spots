FROM node:24-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
EXPOSE 7010
ENV PORT=7010
CMD ["node", "src/index.js"]
