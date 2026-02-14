# استفاده از نسخه رسمی که همه چیز را نصب شده دارد
FROM ghcr.io/puppeteer/puppeteer:21.5.2

# تنظیم متغیرهای محیطی حیاتی
# 1. دانلود کروم توسط npm را متوقف می‌کنیم (چون ایمیج خودش دارد)
# 2. مسیر اجرایی کروم را مشخص می‌کنیم
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/app

# کپی کردن پکیج‌ها با دسترسی کاربر pptruser (خیلی مهم)
# ایمیج‌های رسمی با کاربر root اجرا نمی‌شوند، پس باید مالک فایل‌ها را عوض کنیم
COPY --chown=pptruser:pptruser package*.json ./

# نصب فقط وابستگی‌های پروژه (بدون دانلود کروم)
RUN npm ci

# کپی بقیه فایل‌ها
COPY --chown=pptruser:pptruser . .

# اکسپوز پورت
EXPOSE 3000

# اجرای برنامه
CMD [ "node", "index.js" ]
