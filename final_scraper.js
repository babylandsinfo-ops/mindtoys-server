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

// ✅ সব ক্যাটাগরি অ্যাড করা হলো
const CATEGORIES = [
    { name: "Toys & Gaming", url: "https://babybazarbd.com/product-category/toys/" },
    { name: "Baby Care", url: "https://babybazarbd.com/product-category/baby-care/" },
    { name: "Feeding & Nursing", url: "https://babybazarbd.com/product-category/feeding-and-nursing/" },
    { name: "Moms Care", url: "https://babybazarbd.com/product-category/moms-care/" },
    { name: "Art & Craft", url: "https://babybazarbd.com/product-category/arts-and-crafts/" },
    { name: "Stationary", url: "https://babybazarbd.com/product-category/school-essentials/stationary/" },
    { name: "Footwear", url: "https://babybazarbd.com/product-category/footwear/" }
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

const finalScrape = async () => {
    console.log("🚀 Starting FINAL Scraper (FULL POWER)...");
    
    const browser = await puppeteer.launch({ 
        headless: "new",
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    let totalGlobal = 0;

    for (const category of CATEGORIES) {
        console.log(`\n📂 Processing Category: ${category.name}`);
        
        // 🔄 Loop: 1 to 30 (যাতে Toys এর ২৬ পেজ সব আসে)
        for (let i = 1; i <= 30; i++) {
            let url = i === 1 ? category.url : `${category.url}page/${i}/`;
            console.log(`   📄 Visiting Page ${i}: ${url}`);

            try {
                const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
                if (response.status() === 404) {
                    console.log("   ⛔ 404 - End of category.");
                    break; // পেজ শেষ হলে লুপ থামবে
                }

                console.log("   ⏳ Scrolling...");
                await autoScroll(page);
                await new Promise(r => setTimeout(r, 2000)); 

                const products = await page.evaluate((catName) => {
                    const items = [];
                    const uniqueNames = new Set();

                    const cards = document.querySelectorAll('.product-small, .col-inner, .product-item, .type-product');
                    
                    cards.forEach(card => {
                        let nameEl = card.querySelector('.name') || card.querySelector('.woocommerce-loop-product__title') || card.querySelector('h3');
                        let priceEl = card.querySelector('.price bdi') || card.querySelector('.amount');
                        let imgEl = card.querySelector('img');

                        if (nameEl && priceEl && imgEl) {
                            let name = nameEl.innerText.trim();
                            let priceText = priceEl.innerText.replace(/[^0-9.]/g, '');
                            let price = parseFloat(priceText);
                            let image = imgEl.dataset.src || imgEl.src; 

                            if (name.length > 3 && price > 0 && !uniqueNames.has(name)) {
                                uniqueNames.add(name);
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
                    await Product.insertMany(products);
                    console.log(`   ✅ Saved ${products.length} products.`);
                    totalGlobal += products.length;
                } else {
                    console.log(`   ⚠️ No products found on Page ${i}.`);
                }

            } catch (error) {
                console.log(`   ❌ Error on Page ${i}: ${error.message}`);
                // এরর হলেও পরের পেজে যাওয়ার চেষ্টা করবে
            }
        }
    }

    console.log(`\n🎉 MISSION ACCOMPLISHED! Total Saved: ${totalGlobal}`);
    await browser.close();
    mongoose.connection.close();
};

finalScrape();