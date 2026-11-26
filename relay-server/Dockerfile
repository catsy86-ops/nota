FROM node:26-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY core.js storage.js config.js server.js ./
# Zwykły użytkownik zamiast roota; katalog danych musi do niego należeć.
RUN mkdir -p /data && chown node:node /data
# TRUST_PROXY celowo bez wartości domyślnej: za reverse proxy ustaw `-e TRUST_PROXY=1 -e TRUSTED_PROXY=<adres pośrednika>`.
# Produkcja: serwer bez ALLOWED_ORIGINS (albo z „*”) nie wystartuje — S4.3.
ENV NODE_ENV=production PORT=4466 DATA_DIR=/data
USER node
VOLUME /data
EXPOSE 4466
HEALTHCHECK --interval=60s --timeout=5s --retries=3 CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1
CMD ["node", "server.js"]
