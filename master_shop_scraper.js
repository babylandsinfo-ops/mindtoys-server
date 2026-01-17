const mongoose = require('mongoose');
const puppeteer = require('puppeteer');
require('dotenv').config();

// ডাটাবেস স্কিমা
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

// অটো স্ক্রল ফাংশন (ছবি লোড করার জন্য)
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
            }, 40); 
        });
    });
}

const scrapeAllProducts = async () => {
    console.log("🚀 Starting MASTER Scraper (All Products from Shop Page)...");
    
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');

    // 🎯 মূল শপ লিংক (যেখানে সব প্রোডাক্ট থাকে)
    const BASE_URL = "https://babybazarbd.com/shop/"; 
    
    let grandTotalAdded = 0;
    let consecutiveEmptyPages = 0;

    // 🔄 লুপ: ১ থেকে ৬০ পেজ পর্যন্ত খুঁজবে (প্রায় ১৫০০ প্রোডাক্ট কভার করবে)
    for (let i = 1; i <= 60; i++) {
        let url = i === 1 ? BASE_URL : `${BASE_URL}page/${i}/`;
        console.log(`\n📄 Visiting Shop Page ${i}: ${url}`);

        try {
            const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
            
            // যদি পেজ না থাকে (404)
            if (response.status() === 404) {
                console.log("   ⛔ 404 Error - End of website reached.");
                break;
            }

            // ছবি লোড করার জন্য স্ক্রল
            await autoScroll(page);
            
            // ডাটা স্ক্র্যাপ করা
            const productsOnPage = await page.evaluate(() => {
                const items = [];
                // ওয়েবসাইটের সব প্রোডাক্ট কার্ড সিলেক্টর
                const cards = document.querySelectorAll('.product-small, .col-inner, .type-product');
                
                cards.forEach(card => {
                    // নাম খোঁজা
                    let nameEl = card.querySelector('.name, .woocommerce-loop-product__title, h3, a');
                    let name = nameEl ? nameEl.innerText.trim() : "";

                    // দাম খোঁজা
                    let priceEl = card.querySelector('.price bdi, .amount');
                    let priceText = priceEl ? priceEl.innerText.replace(/[^0-9.]/g, '') : "0";
                    let price = parseFloat(priceText);

                    // ক্যাটাগরি খোঁজা (Product এর ছোট টেক্সট থেকে)
                    let catEl = card.querySelector('.category, .cat-label');
                    let category = catEl ? catEl.innerText.trim() : "General";

                    // ছবি খোঁজা
                    let imgEl = card.querySelector('img');
                    let image = imgEl ? (imgEl.dataset.src || imgEl.src) : "";

                    if (name.length > 2 && price > 0 && image) {
                        items.push({
                            name,
                            price,
                            category,
                            image,
                            sourceUrl: image
                        });
                    }
                });
                return items;
            });

            if (productsOnPage.length === 0) {
                console.log(`   ⚠️ No products found on page ${i}.`);
                consecutiveEmptyPages++;
                if (consecutiveEmptyPages > 2) {
                    console.log("   🛑 Stopping due to multiple empty pages.");
                    break;
                }
                continue;
            }

            consecutiveEmptyPages = 0; // রিসেট

            // 🛡️ ডুপ্লিকেট চেক এবং সেভ
            let addedCount = 0;
            let skippedCount = 0;

            for (const p of productsOnPage) {
                // নাম দিয়ে চেক করা হচ্ছে প্রোডাক্টটি ডাটাবেসে আছে কিনা
                const exists = await Product.findOne({ name: p.name });
                
                if (!exists) {
                    await Product.create(p);
                    addedCount++;
                } else {
                    skippedCount++;
                }
            }

            if (addedCount > 0) {
                console.log(`   ✅ Added: ${addedCount} NEW products.`);
                console.log(`   💤 Skipped: ${skippedCount} duplicates.`);
                grandTotalAdded += addedCount;
            } else {
                console.log(`   💤 All ${skippedCount} products on this page already exist.`);
            }

        } catch (error) {
            console.log(`   ❌ Error on Page ${i}: ${error.message}`);
        }
    }

    console.log(`\n🎉 MASTER MISSION COMPLETE!`);
    console.log(`📦 Total New Products Added: ${grandTotalAdded}`);
    
    await browser.close();
    mongoose.connection.close();
};

scrapeAllProducts();