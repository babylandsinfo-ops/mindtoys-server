const mongoose = require('mongoose');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    category: String,
    image: String,
    sourceUrl: String,
    qty: { type: Number, default: 20 }
});

const Product = mongoose.model('Product', productSchema);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected..."))
    .catch(err => console.log(err));

const CATEGORIES = [
    { name: "Toys & Gaming", url: "https://babybazarbd.com/product-category/toys/" },
    { name: "Art & Craft", url: "https://babybazarbd.com/product-category/arts-and-crafts/" },
    { name: "Baby Care", url: "https://babybazarbd.com/product-category/baby-care/" }
    // টেস্ট করার জন্য আপাতত কম ক্যাটাগরি রাখলাম
];

const scrapeWithDebug = async () => {
    console.log("🚀 Starting Robust Scraper...");
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // ব্রাউজারকে ল্যাপটপ ইউজার হিসেবে দেখানো
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });

    let totalSaved = 0;

    for (const category of CATEGORIES) {
        console.log(`\n📂 Category: ${category.name}`);
        let pageNum = 1;
        let keepScraping = true;

        while (keepScraping) {
            // ✅ FIX: পেজ ১ এর জন্য নরমাল URL, পেজ ২+ এর জন্য /page/x
            const targetUrl = pageNum === 1 ? category.url : `${category.url}page/${pageNum}/`;
            
            console.log(`   Trying: ${targetUrl}`);

            try {
                const response = await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                
                if (response.status() === 404) {
                    console.log("   ⛔ 404 Reached (End of pages).");
                    break;
                }

                // ডাটা স্ক্র্যাপ করা
                const products = await page.evaluate((catName) => {
                    const items = [];
                    // ✅ FIX: একাধিক সিলেক্টর চেক করা (WooCommerce Standard)
                    const cards = document.querySelectorAll('.product-small, .type-product, .product');

                    cards.forEach(card => {
                        // নাম খোঁজা (বিভিন্ন ক্লাসে)
                        let name = "";
                        const nameEl = card.querySelector('.name, .woocommerce-loop-product__title, .product-title');
                        if (nameEl) name = nameEl.innerText.trim();

                        // দাম খোঁজা
                        let price = 0;
                        const priceEl = card.querySelector('.price .amount bdi, .price .amount');
                        if (priceEl) {
                            price = parseFloat(priceEl.innerText.replace(/[^0-9.]/g, ''));
                        }

                        // ইমেজ খোঁজা
                        let image = "";
                        const imgEl = card.querySelector('img');
                        if (imgEl) {
                            image = imgEl.getAttribute('data-src') || imgEl.getAttribute('src') || "";
                        }

                        if (name && price > 0) {
                            items.push({
                                name,
                                price,
                                category: catName,
                                image,
                                sourceUrl: targetUrl
                            });
                        }
                    });
                    return items;
                }, category.name);

                if (products.length === 0) {
                    console.log(`   ⚠️ No products found on page ${pageNum}.`);
                    // 📸 ডিবাগিং: কেন প্রোডাক্ট পেল না তার স্ক্রিনশট নেওয়া
                    await page.screenshot({ path: `error_page_${pageNum}.png` });
                    console.log("   📸 Screenshot saved as 'error_page.png' for checking.");
                    keepScraping = false;
                } else {
                    await Product.insertMany(products);
                    console.log(`   ✅ Success! Saved ${products.length} items.`);
                    totalSaved += products.length;
                    pageNum++;
                }

            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
                keepScraping = false;
            }
        }
    }

    console.log(`\n🎉 Total Products Added: ${totalSaved}`);
    await browser.close();
    mongoose.connection.close();
};

scrapeWithDebug();