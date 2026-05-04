FROM node:20-bullseye

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY .env.example ./.env.example
COPY docs ./docs
COPY deploy ./deploy

EXPOSE 4001

CMD ["npm", "start"]
