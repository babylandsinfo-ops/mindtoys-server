const mongoose = require('mongoose');
const puppeteer = require('puppeteer');
require('dotenv').config();

// ১. ডাটাবেস কানেকশন
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mindtoys')
    .then(() => console.log("✅ MongoDB Connected..."))
    .catch(err => console.error("❌ DB Connection Error:", err));

const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    category: String,
    description: String,
    image: String,
    qty: Number,
    sourceUrl: String,
    createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema, 'products');

// ২. টার্গেট ক্যাটাগরি (বেইজ ইউআরএল)
const targets = [
    { category: "Toys & Gaming", url: "https://babybazarbd.com/product-category/toys/" },
    { category: "Baby Care", url: "https://babybazarbd.com/product-category/baby-care/" },
    { category: "Feeding", url: "https://babybazarbd.com/product-category/feeding-nursing/" },
    { category: "Fashion", url: "https://babybazarbd.com/product-category/clothes-footwear/" },
    { category: "Art & Craft", url: "https://babybazarbd.com/product-category/art-craft/" },
    { category: "Food", url: "https://babybazarbd.com/product-category/baby-food/" },
    { category: "Gear", url: "https://babybazarbd.com/product-category/gear-travel/" },
    { category: "Maternity", url: "https://babybazarbd.com/product-category/moms-maternity/" }
];

const scrapeAndSave = async () => {
    const browser = await puppeteer.launch({ 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }); 
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    for (const target of targets) {
        console.log(`\n=================================================`);
        console.log(`🚀 Starting Category: ${target.category}`);
        console.log(`=================================================`);
        
        let pageNum = 1;
        let hasNextPage = true;

        // 🔥 PAGINATION LOOP: যতক্ষণ প্রোডাক্ট পাবে, ততক্ষণ লুপ চলবে
        while (hasNextPage) {
            // পেজ ১ হলে নরমাল URL, পেজ ২+ হলে 'page/X/' যোগ হবে
            const pageUrl = pageNum === 1 ? target.url : `${target.url}page/${pageNum}/`;
            
            console.log(`\n📄 Scraping Page ${pageNum}... [${pageUrl}]`);

            try {
                const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                
                // যদি পেজ না থাকে (404), তাহলে লুপ ব্রেক
                if (response.status() === 404) {
                    console.log("   ⛔ End of pages reached (404). Moving to next category.");
                    hasNextPage = false;
                    break;
                }

                // লিংক সংগ্রহ করা
                const productLinks = await page.evaluate(() => {
                    let links = [];
                    // Method 1
                    const method1 = Array.from(document.querySelectorAll('.woocommerce-LoopProduct-link')).map(a => a.href);
                    if (method1.length > 0) return method1;
                    // Method 2
                    const method2 = Array.from(document.querySelectorAll('.product a')).map(a => a.href);
                    return [...new Set(method2)].filter(link => link.includes('/product/'));
                });

                if (productLinks.length === 0) {
                    console.log("   ⛔ No products found on this page. Loop Finished.");
                    hasNextPage = false;
                    break;
                }

                console.log(`   🔎 Found ${productLinks.length} products on Page ${pageNum}. Extracting...`);

                // প্রতি প্রোডাক্টের ডিটেইলস স্ক্র্যাপ করা
                for (const link of productLinks) {
                    try {
                        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 60000 });

                        const productData = await page.evaluate((category) => {
                            const nameEl = document.querySelector('h1.product_title');
                            const name = nameEl ? nameEl.innerText.trim() : null;

                            const priceEl = document.querySelector('.price .woocommerce-Price-amount bdi') || document.querySelector('.price');
                            let price = 0;
                            if (priceEl) {
                                const priceText = priceEl.innerText.replace(/[^0-9.]/g, ''); 
                                price = parseFloat(priceText);
                            }

                            const descEl = document.querySelector('.woocommerce-product-details__short-description') 
                                        || document.querySelector('#tab-description')
                                        || document.querySelector('.description');
                            const description = descEl ? descEl.innerText.trim().slice(0, 600).replace(/\n/g, " ") : "Interactive baby product.";

                            const imgEl = document.querySelector('.woocommerce-product-gallery__image img') 
                                       || document.querySelector('.images img');
                            const image = imgEl ? imgEl.src : '';

                            return { name, price, category, description, image, qty: 20 };
                        }, target.category);

                        // ডাটা ভ্যালিডেশন ও সেভ
                        if (productData.name && !productData.name.includes('%') && productData.price > 0) {
                            const exists = await Product.findOne({ name: productData.name });
                            if (!exists) {
                                const newProduct = new Product({ ...productData, sourceUrl: link });
                                await newProduct.save();
                                console.log(`   ✅ Saved: ${productData.name.substring(0, 30)}...`);
                            }
                        }

                    } catch (err) {
                        // console.error(`Skipping link: ${link}`);
                    }
                }
                
                // সফল হলে পরের পেজে যাওয়ার প্রস্তুতি
                pageNum++;

            } catch (error) {
                console.log("   ❌ Error loading page (likely end of pagination).");
                hasNextPage = false;
            }
        }
    }

    console.log("\n🎉 ALL Categories Scraped Successfully!");
    await browser.close();
    process.exit();
};

scrapeAndSave();