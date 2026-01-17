const mongoose = require('mongoose');
const puppeteer = require('puppeteer');
require('dotenv').config();

// ১. প্রোডাক্ট স্কিমা
const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    description: String,
    category: String,
    image: String,
    qty: { type: Number, default: 20 }
});

const Product = mongoose.model('Product', productSchema);

// ২. ডাটাবেস কানেকশন
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected..."))
    .catch(err => console.log(err));

// ৩. মেইন স্ক্র্যাপিং ফাংশন
const scrapeMindToys = async () => {
    console.log("🤖 Launching Browser (Puppeteer)...");
    
    // ব্রাউজার ওপেন করা হচ্ছে
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    try {
        // টার্গেট URL (Shop Page)
        const url = 'https://mindtoys.xyz/shop/'; 
        console.log(`🕵️‍♂️ Visiting: ${url}`);
        
        // পেজে যাওয়া এবং লোড হওয়া পর্যন্ত অপেক্ষা করা
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        console.log("📄 Page Loaded! Extracting Data...");

        // ব্রাউজারের ভেতর থেকে ডাটা টেনে আনা
        const products = await page.evaluate(() => {
            const items = [];
            // সব প্রোডাক্ট কার্ড সিলেক্ট করা
            const productCards = document.querySelectorAll('.product');

            productCards.forEach(card => {
                // নাম
                const nameElement = card.querySelector('.woocommerce-loop-product__title, .product-title');
                const name = nameElement ? nameElement.innerText.trim() : null;

                // দাম (টেক্সট ক্লিন করা হচ্ছে)
                const priceElement = card.querySelector('.price bdi') || card.querySelector('.price .amount');
                let price = 0;
                if (priceElement) {
                    const priceText = priceElement.innerText.replace('৳', '').replace(/,/g, '');
                    price = parseFloat(priceText);
                }

                // ছবি (Data Source বা Source খোঁজা)
                const imgElement = card.querySelector('img');
                let image = null;
                if (imgElement) {
                    image = imgElement.getAttribute('src');
                    // অনেক সময় হাই-কোয়ালিটি ইমেজ data-src বা srcset এ থাকে, তবে src সাধারণত কাজ করে
                }

                // ক্যাটাগরি (যেহেতু শপ পেজ, তাই ডিফল্ট ক্যাটাগরি দিচ্ছি)
                const category = "Kids & Development";

                if (name && price > 0 && image) {
                    items.push({
                        name,
                        price,
                        image,
                        description: `Imported from MindToys XYZ - ${name}`,
                        category,
                        qty: 20
                    });
                }
            });
            return items;
        });

        console.log(`📦 Found ${products.length} products!`);

        if (products.length > 0) {
            // আগের ডাটা ক্লিয়ার করে নতুন ডাটা আপলোড
            await Product.deleteMany({});
            console.log("🧹 Cleared old database...");
            
            await Product.insertMany(products);
            console.log("🎉 SUCCESS! All products uploaded to your database.");
        } else {
            console.log("⚠️ No products found. The website structure might have changed.");
        }

    } catch (error) {
        console.error("❌ Scraping Error:", error);
    } finally {
        await browser.close();
        mongoose.connection.close();
    }
};

scrapeMindToys();