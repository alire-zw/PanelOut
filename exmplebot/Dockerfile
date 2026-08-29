FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY src ./src
COPY public ./public
COPY docker/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENV NODE_ENV=production

EXPOSE 4444

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/index.js"]
