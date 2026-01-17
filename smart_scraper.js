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

const CATEGORIES = [
    { name: "Baby Care", url: "https://babybazarbd.com/product-category/baby-care/" },
    { name: "Toys & Gaming", url: "https://babybazarbd.com/product-category/toys/" },
    { name: "Art & Craft", url: "https://babybazarbd.com/product-category/arts-and-crafts/" }
];

const smartScrape = async () => {
    console.log("🚀 Starting Smart Scraper (Logic: Find '৳' symbol)...");
    
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // হাই রেজোলিউশন স্ক্রিন সেট করা (যাতে সব প্রোডাক্ট লোড হয়)
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    let totalSaved = 0;

    for (const category of CATEGORIES) {
        console.log(`\n📂 Visiting: ${category.name}`);
        
        try {
            await page.goto(category.url, { waitUntil: 'networkidle2', timeout: 90000 });
            
            // পেজের একদম নিচে স্ক্রল করা (যাতে সব ছবি লোড হয়)
            await page.evaluate(async () => {
                await new Promise((resolve) => {
                    let totalHeight = 0;
                    const distance = 100;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if(totalHeight >= scrollHeight){
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                });
            });

            // 🧠 স্মার্ট লজিক: '৳' চিহ্নওয়ালা এলিমেন্ট খুঁজে তার বাবাকে (Parent) ধরা
            const products = await page.evaluate((catName) => {
                const items = [];
                // ১. পৃষ্ঠার সব এলিমেন্ট খোঁজো যার মধ্যে '৳' আছে
                const allElements = document.body.querySelectorAll('*');
                
                allElements.forEach(el => {
                    if (el.children.length === 0 && el.innerText.includes('৳')) { // একদম শেষের টেক্সট নোড
                        
                        // দাম বের করা
                        const priceText = el.innerText.replace(/[^0-9.]/g, '');
                        const price = parseFloat(priceText);

                        if (price > 0) {
                            // ২. উপরের দিকে গিয়ে মেইন কার্ড খোঁজা (Parent Traversal)
                            // আমরা ৩-৪ ধাপ উপরে গিয়ে দেখব ইমেজ এবং নাম পাই কিনা
                            let parent = el.parentElement;
                            let name = "";
                            let image = "";
                            let found = false;

                            // ৫ ধাপ পর্যন্ত উপরে চেক করব
                            for (let i = 0; i < 5; i++) {
                                if (!parent) break;

                                // নাম খোঁজা (H2, H3 বা strong ট্যাগে সাধারণত নাম থাকে)
                                const nameEl = parent.querySelector('h2, h3, .name, .title, a');
                                if (nameEl && nameEl.innerText.length > 5) {
                                    name = nameEl.innerText.trim();
                                }

                                // ছবি খোঁজা
                                const imgEl = parent.querySelector('img');
                                if (imgEl) {
                                    image = imgEl.src || imgEl.dataset.src;
                                }

                                // যদি নাম, দাম, ছবি ৩টাই পাই -> Bingo!
                                if (name && image && price) {
                                    // ডুপ্লিকেট চেক (একই প্রোডাক্ট বারবার আসতে পারে)
                                    const exists = items.find(i => i.name === name);
                                    if (!exists) {
                                        items.push({
                                            name,
                                            price,
                                            category: catName,
                                            image,
                                            sourceUrl: image
                                        });
                                    }
                                    found = true;
                                    break; 
                                }
                                parent = parent.parentElement;
                            }
                        }
                    }
                });
                return items;
            }, category.name);

            if (products.length > 0) {
                await Product.insertMany(products);
                console.log(`   ✅ Success! Found & Saved ${products.length} products.`);
                totalSaved += products.length;
            } else {
                console.log("   ⚠️ Still no products found. Layout is very tricky.");
            }

        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    console.log(`\n🎉 Total Products Added: ${totalSaved}`);
    await browser.close();
    mongoose.connection.close();
};

smartScrape();