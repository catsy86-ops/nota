FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY core.js server.js ./
ENV PORT=4466 DATA_DIR=/data TRUST_PROXY=1
VOLUME /data
EXPOSE 4466
CMD ["node", "server.js"]
