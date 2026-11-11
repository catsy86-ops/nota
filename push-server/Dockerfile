FROM node:22-alpine
WORKDIR /app
# Zależności z lockfile, żeby kolejne budowy dawały te same wersje.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY core.js server.js ./
# Serwer działa jako zwykły użytkownik, nie root; katalog danych musi do niego należeć.
RUN mkdir -p /data && chown node:node /data
ENV PORT=4455 DATA_DIR=/data
# PUSH_TOKEN i ALLOWED_ORIGINS podaj przy `docker run -e` — bez tokenu serwer nie wystartuje.
USER node
VOLUME /data
EXPOSE 4455
HEALTHCHECK --interval=60s --timeout=5s --retries=3 CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1
CMD ["node", "server.js"]
