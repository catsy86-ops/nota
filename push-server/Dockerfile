FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY core.js server.js ./
ENV PORT=4455 DATA_DIR=/data
VOLUME /data
EXPOSE 4455
CMD ["node", "server.js"]
