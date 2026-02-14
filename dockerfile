FROM node:18-slim

# 1. نصب وابستگی‌های سیستمی لازم برای اجرای کروم
# این لیست شامل تمام کتابخانه‌هایی است که Puppeteer برای اجرا نیاز دارد
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 2. تنظیم متغیرهای محیطی
# به Puppeteer می‌گوییم که کروم را دانلود نکند و از نسخه نصب شده سیستم استفاده کند
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

COPY package*.json ./

# نصب پکیج‌ها
RUN npm ci

COPY . .

EXPOSE 3000

CMD [ "node", "index.js" ]
