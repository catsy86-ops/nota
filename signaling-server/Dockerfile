FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
ENV PORT=4444
EXPOSE 4444
CMD ["npm", "start"]
