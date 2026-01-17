const mongoose = require('mongoose');
const puppeteer = require('puppeteer');
require('dotenv').config();

// ১. ডাটাবেস স্কিমা (Filter এর জন্য প্রস্তুত)
const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    description: String,
    category: String,      // যেমন: Toys, Baby Care
    subcategory: String,   // যেমন: Puzzle, Walker (URL থেকে বের করব)
    image: String,
    sourceUrl: String,
    qty: { type: Number, default: 20 }
});

const Product = mongoose.model('Product', productSchema);

// ২. ডাটাবেস কানেকশন
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected..."))
    .catch(err => console.log(err));

// ৩. ক্যাটাগরি ম্যাপ (যেই লিংকগুলো থেকে ডাটা আনব)
// বাম পাশে আমাদের সাইটের নাম, ডান পাশে সোর্স লিংক
const CATEGORIES_TO_SCRAPE = [
    {
        name: "Toys & Gaming",
        url: "https://babybazarbd.com/product-category/toys/"
    },
    {
        name: "Art & Craft",
        url: "https://babybazarbd.com/product-category/arts-and-crafts/"
    },
    {
        name: "Baby Care",
        url: "https://babybazarbd.com/product-category/baby-care/"
    },
    {
        name: "Feeding & Nursing",
        url: "https://babybazarbd.com/product-category/feeding-and-nursing/"
    },
    {
        name: "Moms Care",
        url: "https://babybazarbd.com/product-category/moms-care/"
    },
    {
        name: "Stationary",
        url: "https://babybazarbd.com/product-category/school-essentials/stationary/"
    }
];

const scrapeAllCategories = async () => {
    console.log("🚀 Starting Universal Scraper...");
    
    // ব্রাউজার লঞ্চ করা
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    // ব্রাউজারকে আসল মানুষের মতো দেখানো
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    let totalProductsCollected = 0;

    // ৪. লুপ: প্রতিটি ক্যাটাগরি চেক করা
    for (const category of CATEGORIES_TO_SCRAPE) {
        console.log(`\n📂 Starting Category: ${category.name}`);
        let pageNum = 1;
        let hasMorePages = true;

        while (hasMorePages) {
            // URL বানানো (Dynamic Pagination)
            const url = `${category.url}page/${pageNum}/`;
            console.log(`   📄 Scraping Page ${pageNum}...`);

            try {
                // পেজে যাওয়া (Time out বাড়ান হলো যাতে স্লো নেটে ক্র্যাশ না করে)
                const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

                // যদি পেজ না থাকে (404 Error), লুপ বন্ধ করো
                if (response.status() === 404) {
                    console.log("   ⛔ End of pages reached (404).");
                    hasMorePages = false;
                    break;
                }

                // ডাটা তোলা
                const productsOnPage = await page.evaluate((catName) => {
                    const items = [];
                    // BabyBazar এর নির্দিষ্ট ক্লাস 'product-small'
                    const cards = document.querySelectorAll('.product-small');

                    if (cards.length === 0) return []; // কোনো প্রোডাক্ট না পেলে খালি অ্যারে

                    cards.forEach(card => {
                        const nameEl = card.querySelector('.name');
                        const name = nameEl ? nameEl.innerText.trim() : "Unknown";

                        const priceEl = card.querySelector('.price .amount bdi');
                        let price = 0;
                        if (priceEl) {
                            const priceText = priceEl.innerText.replace(/[^0-9.]/g, ''); 
                            price = parseFloat(priceText);
                        }

                        // ইমেজ (Lazy load হ্যান্ডেল করা)
                        const imgEl = card.querySelector('img');
                        let image = "";
                        if (imgEl) {
                            image = imgEl.dataset.src || imgEl.src;
                        }

                        if (price > 0 && name !== "Unknown") {
                            items.push({
                                name,
                                price,
                                category: catName,
                                image,
                                sourceUrl: image,
                                description: `Imported product for ${catName}`
                            });
                        }
                    });
                    return items;
                }, category.name);

                // যদি এই পেজে কোনো প্রোডাক্ট না পাওয়া যায়, তার মানে শেষ পেজ
                if (productsOnPage.length === 0) {
                    console.log("   ⛔ No products found on this page. Moving to next category.");
                    hasMorePages = false;
                    break;
                }

                // ডাটাবেসে সেভ করা (প্রতি পেজ শেষেই সেভ হবে)
                if (productsOnPage.length > 0) {
                    await Product.insertMany(productsOnPage);
                    console.log(`   ✅ Saved ${productsOnPage.length} products from page ${pageNum}`);
                    totalProductsCollected += productsOnPage.length;
                }

                pageNum++; // পরের পেজের জন্য রেডি

            } catch (error) {
                console.log(`   ❌ Error on page ${pageNum}: ${error.message}`);
                // এরর খেলেও আমরা থামব না, পরের ক্যাটাগরিতে যাওয়ার চেষ্টা করব
                hasMorePages = false; 
            }
        }
    }

    console.log(`\n🎉 MISSION COMPLETE! Total Products Added: ${totalProductsCollected}`);
    
    await browser.close();
    mongoose.connection.close();
};

// ** সতর্কতা: এটি আগের ডাটা মুছে দেবে না, নতুন ডাটা যোগ করবে **
scrapeAllCategories();