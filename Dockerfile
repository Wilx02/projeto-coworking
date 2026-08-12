FROM node:22-alpine
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
RUN mkdir -p /app/data
COPY data ./data
RUN chown -R node:node /app
EXPOSE 3000
USER node
CMD ["node", "server.js"]
