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

// ডাটাবেস কানেকশন
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected..."))
    .catch(err => console.log(err));

// 📋 BabyBazar এর সম্পূর্ণ ক্যাটাগরি লিস্ট
const ALL_CATEGORIES = [
    { name: "Toys & Gaming", url: "https://babybazarbd.com/product-category/toys/" },
    { name: "Baby Care", url: "https://babybazarbd.com/product-category/baby-care/" },
    { name: "Feeding & Nursing", url: "https://babybazarbd.com/product-category/feeding-and-nursing/" },
    { name: "Moms Care", url: "https://babybazarbd.com/product-category/moms-care/" },
    { name: "Art & Craft", url: "https://babybazarbd.com/product-category/arts-and-crafts/" },
    { name: "Stationary", url: "https://babybazarbd.com/product-category/school-essentials/stationary/" },
    { name: "Footwear", url: "https://babybazarbd.com/product-category/footwear/" },
    { name: "Clothes & Fashion", url: "https://babybazarbd.com/product-category/clothing/" }, // মিসিং ছিল
    { name: "Baby Food", url: "https://babybazarbd.com/product-category/baby-food/" }, // মিসিং ছিল
    { name: "Lifestyle & Accessories", url: "https://babybazarbd.com/product-category/lifestyle/" }, // মিসিং ছিল
    { name: "Diaper & Wipes", url: "https://babybazarbd.com/product-category/diaper/" } // এক্সট্রা
];

// অটোমেটিক স্ক্রল ফাংশন (ছবি লোড করার জন্য)
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
            }, 40); // একটু ফাস্ট স্ক্রল
        });
    });
}

const importFullWebsite = async () => {
    console.log("🚀 Starting Full Website Import (Safe Mode)...");
    console.log("ℹ️ Existing products will be skipped. Only new ones will be added.\n");
    
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    // হাই-এন্ড পিসি ইউজার এজেন্ট
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');

    let grandTotalAdded = 0;

    for (const category of ALL_CATEGORIES) {
        console.log(`\n📂 Processing: ${category.name}`);
        
        // প্রতি ক্যাটাগরিতে সর্বোচ্চ ৫০ পেজ পর্যন্ত খুঁজবে
        for (let i = 1; i <= 50; i++) {
            let url = i === 1 ? category.url : `${category.url}page/${i}/`;
            
            try {
                const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
                
                // যদি পেজ না থাকে (404) -> পরের ক্যাটাগরিতে যাও
                if (response.status() === 404) {
                    console.log(`   ⛔ End of ${category.name} at page ${i-1}`);
                    break; 
                }

                // স্ক্রল করে ছবি লোড করা
                await autoScroll(page);
                
                // ডাটা স্ক্র্যাপ করা
                const productsOnPage = await page.evaluate((catName) => {
                    const items = [];
                    // BabyBazar এর কমন ক্লাসগুলো টার্গেট করা
                    const cards = document.querySelectorAll('.product-small, .col-inner, .type-product');
                    
                    cards.forEach(card => {
                        let nameEl = card.querySelector('.name, .woocommerce-loop-product__title');
                        let priceEl = card.querySelector('.price bdi');
                        let imgEl = card.querySelector('img');

                        if (nameEl && priceEl && imgEl) {
                            let name = nameEl.innerText.trim();
                            // দাম থেকে কমা (,) এবং টাকা চিহ্ন সরানো
                            let priceText = priceEl.innerText.replace(/[^0-9.]/g, '');
                            let price = parseFloat(priceText);
                            let image = imgEl.dataset.src || imgEl.src; 

                            if (name && price > 0) {
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

                if (productsOnPage.length === 0) {
                    console.log(`   ⚠️ No products visible on Page ${i}. Moving next.`);
                    break;
                }

                // 🛡️ ডুপ্লিকেট চেক করে ইনসার্ট করা
                let newCount = 0;
                for (const p of productsOnPage) {
                    // নাম দিয়ে চেক করা হচ্ছে প্রোডাক্টটি আছে কিনা
                    const exists = await Product.findOne({ name: p.name });
                    if (!exists) {
                        await Product.create(p);
                        newCount++;
                    }
                }

                if (newCount > 0) {
                    console.log(`   ✅ Page ${i}: Added ${newCount} new items.`);
                    grandTotalAdded += newCount;
                } else {
                    console.log(`   💤 Page ${i}: All items already exist. Skipped.`);
                }

            } catch (error) {
                console.log(`   ❌ Error on Page ${i}: ${error.message}`);
                // এরর হলেও আমরা থামব না, পরের পেজে ট্রাই করব
            }
        }
    }

    console.log(`\n🎉 FULL IMPORT COMPLETE!`);
    console.log(`📦 Total New Products Added: ${grandTotalAdded}`);
    
    await browser.close();
    mongoose.connection.close();
};

importFullWebsite();