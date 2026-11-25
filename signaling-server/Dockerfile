FROM node:22-alpine
WORKDIR /app
# Zależności z lockfile (Q2.3), żeby kolejne budowy dawały te same wersje; bez skryptów instalacji (S5.6).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
ENV PORT=4444
# Serwer działa jako zwykły użytkownik, nie root (Q2.3) — niczego nie zapisuje na dysk.
USER node
EXPOSE 4444
CMD ["npm", "start"]
