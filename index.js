/**
 * Professional Google SERP Scraper for Railway (Optimized)
 */

const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const UserAgent = require('user-agents');

// فعال‌سازی پلاگین مخفی‌سازی
puppeteer.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 3000;

// تابع تاخیر تصادفی برای شبیه‌سازی رفتار انسان
const randomSleep = (min, max) => {
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1)) + min));
};

app.get('/', async (req, res) => {
    const { q, gl = 'us', hl = 'en', page = 1, device = 'desktop' } = req.query;

    if (!q) {
        return res.status(400).json({ error: "Missing query parameter 'q'" });
    }

    let browser = null;
    try {
        console.log(`Starting scrape for: ${q}`);

        // راه‌اندازی مرورگر
        browser = await puppeteer.launch({
            headless: "new",
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage', // حیاتی برای داکر و Railway (جلوگیری از کرش مموری)
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080'
            ]
        });

        const webPage = await browser.newPage();

        // 1. تنظیم User-Agent و Viewport پیشرفته
        let userAgentStr = '';
        if (device === 'mobile') {
            const userAgent = new UserAgent({ deviceCategory: 'mobile' });
            userAgentStr = userAgent.toString();
            await webPage.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
        } else {
            const userAgent = new UserAgent({ deviceCategory: 'desktop', platform: 'Win32' });
            userAgentStr = userAgent.toString();
            await webPage.setViewport({ width: 1366 + Math.floor(Math.random() * 100), height: 768 });
        }
        
        // جلوگیری از تشخیص WebDriver
        await webPage.setUserAgent(userAgentStr);

        // 2. ساخت URL
        const start = (parseInt(page) - 1) * 10;
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}&gl=${gl}&hl=${hl}&start=${start}`;

        // 3. رفتن به صفحه
        // domcontentloaded سریعتر است، اما networkidle2 مطمئن تر است که تمام اسکریپت ها لود شده اند
        await webPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        
        // کمی صبر برای لود شدن کامل جاوااسکریپت‌های گوگل
        await randomSleep(1000, 3000);

        // 4. مدیریت کوکی (Accept All)
        try {
            const buttons = await webPage.$x("//button[contains(., 'Accept all') or contains(., 'I agree') or contains(., 'L3')]"); // L3 گاهی کلاس دکمه است
            if (buttons.length > 0) {
                await buttons[0].click();
                await webPage.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(() => {});
            }
        } catch (e) { /* نادیده گرفتن */ }

        // 5. دریافت HTML
        const content = await webPage.content();
        const $ = cheerio.load(content);
        const results = [];

        // 6. استخراج نتایج (منطق بهبود یافته)
        // گوگل نتایج را در div.g یا div با کلاس‌های خاص موبایل قرار می‌دهد
        const resultContainers = $('div.g, div[data-header-feature]');

        resultContainers.each((i, el) => {
            try {
                // عنوان معمولا در h3 است
                const title = $(el).find('h3').first().text().trim();
                
                // لینک در تگ a که href آن با http شروع می‌شود
                const linkEl = $(el).find('a[href^="http"]').first();
                const url = linkEl.attr('href');
                
                // توضیحات (Snippet)
                const snippet = $(el).find('div[style*="-webkit-line-clamp"], div.VwiC3b, span.aCOpRe').first().text().trim();

                // فیلتر کردن نتایج نامعتبر
                if (title && url && !url.includes('google.com')) {
                    results.push({
                        rank: results.length + 1 + start,
                        title,
                        url,
                        domain: new URL(url).hostname,
                        snippet
                    });
                }
            } catch (err) {
                // خطای پارس کردن یک آیتم خاص
            }
        });

        // بررسی کپچا
        const isCaptcha = $('form[action*="Captcha"]').length > 0 || $('body').text().includes('unusual traffic');

        res.json({
            meta: {
                query: q,
                results_count: results.length,
                captcha: isCaptcha,
                gl,
                page
            },
            data: results
        });

    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ error: "Failed to scrape", details: error.message });
    } finally {
        if (browser) {
            // بستن تمام صفحات قبل از بستن مرورگر
            const pages = await browser.pages();
            await Promise.all(pages.map(p => p.close()));
            await browser.close();
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
