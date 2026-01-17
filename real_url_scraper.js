const mongoose = require('mongoose');
const puppeteer = require('puppeteer');
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

// ✅ আপনার দেওয়া সঠিক লিংকগুলো এখানে বসানো হয়েছে
const TARGET_URLS = [
    { name: "Clothes & Footwear", url: "https://babybazarbd.com/product-category/clothes-footwear/" },
    { name: "Moms Care", url: "https://babybazarbd.com/product-category/moms-care/" },
    { name: "Baby Care", url: "https://babybazarbd.com/product-category/baby-care/" },
    { name: "Art & Craft", url: "https://babybazarbd.com/product-category/lifestyle/art-craft/" },
    { name: "Special Needs", url: "https://babybazarbd.com/product-category/special-needs/" },
    { name: "Developmental Goals", url: "https://babybazarbd.com/product-category/developmental-goals/" }
];

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if(totalHeight >= scrollHeight - 200){ 
                    clearInterval(timer);
                    resolve();
                }
            }, 50);
        });
    });
}

const scrapeRealUrls = async () => {
    console.log("🚀 Starting Scraper with CONFIRMED URLs...");
    
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');

    for (const category of TARGET_URLS) {
        console.log(`\n📂 Visiting: ${category.name}`);
        
        // প্রতি ক্যাটাগরিতে ১ থেকে ১০ পেজ খুঁজবে
        for (let i = 1; i <= 10; i++) {
            // পেজ ১ হলে সরাসরি লিংক, নাহলে page/x/ ফরম্যাট
            let url = i === 1 ? category.url : `${category.url}page/${i}/`;
            
            try {
                const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
                
                // যদি পেজ না থাকে (404 Error)
                if (response.status() === 404) {
                    console.log(`   ⛔ End of pages for ${category.name}.`);
                    break;
                }

                await autoScroll(page);
                
                // ডাটা সংগ্রহ (Universal Selector)
                const products = await page.evaluate((catName) => {
                    const items = [];
                    // সব ধরণের সম্ভাব্য সিলেক্টর
                    const cards = document.querySelectorAll('.product-small, .col-inner, .type-product');
                    
                    cards.forEach(card => {
                        let nameEl = card.querySelector('.name, .woocommerce-loop-product__title, h3, a');
                        let priceEl = card.querySelector('.price bdi, .amount');
                        let imgEl = card.querySelector('img');

                        if (nameEl && priceEl && imgEl) {
                            let name = nameEl.innerText.trim();
                            let priceText = priceEl.innerText.replace(/[^0-9.]/g, '');
                            let price = parseFloat(priceText);
                            let image = imgEl.dataset.src || imgEl.src;

                            if (name.length > 2 && price > 0) {
                                items.push({
                                    name,
                                    price,
                                    category: catName,
                                    image,
                                    sourceUrl: image
                                });
                            }
                        }
                    });
                    return items;
                }, category.name);

                if (products.length > 0) {
                    let addedCount = 0;
                    for (const p of products) {
                        // ডুপ্লিকেট চেক (আগে থাকলে বাদ)
                        const exists = await Product.findOne({ name: p.name });
                        if (!exists) {
                            await Product.create(p);
                            addedCount++;
                        }
                    }
                    
                    if (addedCount > 0) {
                        console.log(`   ✅ Page ${i}: Added ${addedCount} NEW products.`);
                    } else {
                        console.log(`   💤 Page ${i}: Products already exist. Skipped.`);
                    }
                } else {
                    console.log(`   ⚠️ No products found on Page ${i}.`);
                }

            } catch (error) {
                console.log(`   ❌ Error on Page ${i}: ${error.message}`);
            }
        }
    }

    console.log("\n🎉 Mission Complete! All categories updated.");
    await browser.close();
    mongoose.connection.close();
};

scrapeRealUrls();