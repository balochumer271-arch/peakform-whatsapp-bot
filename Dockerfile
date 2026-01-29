FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Chrome ka rasta set karne ke liye
ENV CHROME_PATH=/usr/bin/google-chrome-stable

CMD ["node", "index.js"]
