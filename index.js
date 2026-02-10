/**
 * Professional Google SERP Scraper for Railway
 * Uses Puppeteer + Stealth Plugin to mimic real user behavior
 */

const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const UserAgent = require('user-agents');

// فعال‌سازی پلاگین مخفی‌سازی برای جلوگیری از تشخیص بات
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', async (req, res) => {
    const { q, gl = 'us', page = 1, device = 'desktop' } = req.query;

    if (!q) {
        return res.status(400).json({ error: "Missing query parameter 'q'" });
    }

    let browser = null;
    try {
        // راه‌اندازی مرورگر با تنظیمات بهینه برای سرور
        browser = await puppeteer.launch({
            headless: "new", // حالت هدلس جدید (سریع‌تر و طبیعی‌تر)
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process', 
                '--disable-gpu'
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH
        });

        const webPage = await browser.newPage();

        // 1. تنظیمات دیوایس و User-Agent
        if (device === 'mobile') {
            const userAgent = new UserAgent({ deviceCategory: 'mobile' });
            await webPage.setUserAgent(userAgent.toString());
            await webPage.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
        } else {
            const userAgent = new UserAgent({ deviceCategory: 'desktop' });
            await webPage.setUserAgent(userAgent.toString());
            await webPage.setViewport({ width: 1366, height: 768 });
        }

        // 2. محاسبه پارامتر Start برای صفحه‌بندی
        const start = (parseInt(page) - 1) * 10;
        
        // ساخت URL گوگل
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}&gl=${gl}&start=${start}&hl=en`;

        // 3. رفتن به صفحه با تایم‌اوت مناسب
        // waitUntil: 'networkidle2' یعنی صبر کن تا شبکه تقریبا آرام شود (لود کامل)
        await webPage.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // 4. مدیریت پاپ‌آپ کوکی (Consent Modal) که در سرورهای اروپا/آمریکا رایج است
        try {
            // تلاش برای پیدا کردن دکمه "Accept all" یا "Reject all"
            // این سلکتورها ممکن است تغییر کنند، ما چند حالت رایج را تست می‌کنیم
            const consentButtons = await webPage.$x("//button[contains(., 'Accept all') or contains(., 'I agree')]");
            if (consentButtons.length > 0) {
                await consentButtons[0].click();
                await webPage.waitForNavigation({ waitUntil: 'networkidle2' });
            }
        } catch (e) {
            // اگر دکمه‌ای نبود یعنی کوکی نخواسته، ادامه می‌دهیم
        }

        // 5. دریافت محتوای HTML و پارس کردن با Cheerio
        const content = await webPage.content();
        const $ = cheerio.load(content);
        const results = [];

        // 6. استخراج نتایج (SERP Extraction Logic)
        // سلکتورهای گوگل مدام عوض می‌شوند، اما ساختار .g معمولا ثابت است
        
        const resultSelector = device === 'mobile' ? 'div.Ww4FFb, div.MjjYud' : 'div.g';

        $(resultSelector).each((index, element) => {
            try {
                // تلاش برای پیدا کردن تگ h3 (عنوان)
                const titleEl = $(element).find('h3').first();
                // تلاش برای پیدا کردن لینک اصلی
                const linkEl = $(element).find('a').first();
                // تلاش برای پیدا کردن اسنیپت (توضیحات)
                const snippetEl = $(element).find('div.VwiC3b, div.yXK7lf, div.MUxGbd').first();

                const title = titleEl.text().trim();
                const url = linkEl.attr('href');
                const snippet = snippetEl.text().trim();

                // اعتبارسنجی: حذف لینک‌های تبلیغاتی یا داخلی گوگل
                if (title && url && url.startsWith('http') && !url.includes('google.com/search')) {
                    
                    // استخراج دامنه تمیز
                    let domain = '';
                    try {
                        const urlObj = new URL(url);
                        domain = urlObj.hostname;
                    } catch (e) {}

                    results.push({
                        rank: results.length + 1 + start,
                        title: title,
                        url: url,
                        domain: domain,
                        snippet: snippet
                    });
                }
            } catch (err) {
                // اگر یک آیتم خطا داشت، کل پروسه نباید متوقف شود
            }
        });

        // بررسی اینکه آیا کپچا خوردیم یا نه
        const isCaptcha = $('form[action*="Captcha"]').length > 0 || $('div:contains("unusual traffic")').length > 0;

        res.json({
            meta: {
                query: q,
                page: page,
                gl: gl,
                device: device,
                total_results: results.length,
                captcha_detected: isCaptcha
            },
            data: results
        });

    } catch (error) {
        console.error("Scraping Error:", error);
        res.status(500).json({ error: error.message });
    } finally {
        // بستن قطعی مرورگر برای جلوگیری از پر شدن رم سرور
        if (browser) {
            await browser.close();
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
