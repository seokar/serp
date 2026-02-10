# استفاده از ایمیج رسمی Puppeteer که کروم را از قبل دارد
FROM ghcr.io/puppeteer/puppeteer:21.5.2

# تنظیم متغیرهای محیطی
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

# کپی کردن فایل‌های پکیج با دسترسی کاربر pptruser (کاربر امنیتی گوگل)
COPY --chown=pptruser:pptruser package*.json ./

# نصب پکیج‌ها
RUN npm ci

# کپی کردن بقیه فایل‌ها
COPY --chown=pptruser:pptruser . .

# پورت برنامه
EXPOSE 3000

# اجرای برنامه
CMD [ "node", "index.js" ]
