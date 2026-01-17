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

// সব ক্যাটাগরি আবার চেক করব (Toys এর ২৬ পেজ সহ)
const CATEGORIES = [
    { name: "Toys & Gaming", url: "https://babybazarbd.com/product-category/toys/" },
    { name: "Clothes & Footwear", url: "https://babybazarbd.com/product-category/clothing/" },
    { name: "Baby Care", url: "https://babybazarbd.com/product-category/baby-care/" },
    { name: "Feeding & Nursing", url: "https://babybazarbd.com/product-category/feeding-and-nursing/" },
    { name: "Art & Craft", url: "https://babybazarbd.com/product-category/arts-and-crafts/" },
    { name: "Stationary", url: "https://babybazarbd.com/product-category/school-essentials/stationary/" }
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

const safeScrape = async () => {
    console.log("🚀 Starting SAFE Scraper (No Duplicates)...");
    
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    for (const category of CATEGORIES) {
        console.log(`\n📂 Checking: ${category.name}`);
        
        // 1 to 26 Pages Loop
        for (let i = 1; i <= 26; i++) {
            let url = i === 1 ? category.url : `${category.url}page/${i}/`;
            
            try {
                const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
                if (response.status() === 404) break; // পেজ শেষ

                await autoScroll(page);
                
                const products = await page.evaluate((catName) => {
                    const items = [];
                    const cards = document.querySelectorAll('.product-small, .col-inner');
                    
                    cards.forEach(card => {
                        let nameEl = card.querySelector('.name');
                        let priceEl = card.querySelector('.price bdi');
                        let imgEl = card.querySelector('img');

                        if (nameEl && priceEl && imgEl) {
                            items.push({
                                name: nameEl.innerText.trim(),
                                price: parseFloat(priceEl.innerText.replace(/[^0-9.]/g, '')),
                                category: catName,
                                image: imgEl.dataset.src || imgEl.src,
                                sourceUrl: imgEl.dataset.src || imgEl.src
                            });
                        }
                    });
                    return items;
                }, category.name);

                // 🔥 Duplicate Check & Insert Loop
                let newAdded = 0;
                for (const p of products) {
                    // ডাটাবেসে নাম চেক করছি
                    const exists = await Product.findOne({ name: p.name });
                    if (!exists) {
                        await Product.create(p);
                        newAdded++;
                    }
                }

                if (newAdded > 0) console.log(`   ✅ Page ${i}: Added ${newAdded} NEW products.`);
                else console.log(`   💤 Page ${i}: No new products.`);

            } catch (error) {
                console.log(`   ❌ Error page ${i}: ${error.message}`);
            }
        }
    }

    console.log("\n🎉 Scraping Finished!");
    await browser.close();
    mongoose.connection.close();
};

safeScrape();