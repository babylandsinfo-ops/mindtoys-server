const express = require('express');
const router = express.Router();
const Product = require('../models/Product'); 

// 🔥 1. GET ALL PRODUCTS (With Filter, Search & Pagination)
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        
        // 🛠️ FIX 1: Trim ব্যবহার করা (যাতে 'Toys ' এবং 'Toys' এর সমস্যা না হয়)
        const category = req.query.category ? req.query.category.trim() : '';
        const search = req.query.search ? req.query.search.trim() : '';
        
        const minPrice = parseInt(req.query.minPrice) || 0;
        const maxPrice = parseInt(req.query.maxPrice) || 1000000;

        let query = {};

        // ক্যাটাগরি ফিল্টার
        if (category && category !== 'All') {
            query.category = category;
        }

        // সার্চ ফিল্টার
        if (search) {
            query.name = { $regex: search, $options: 'i' }; 
        }

        // প্রাইস ফিল্টার
        if (req.query.minPrice || req.query.maxPrice) {
            query.price = { $gte: minPrice, $lte: maxPrice };
        }

        const total = await Product.countDocuments(query);

        const products = await Product.find(query)
            .sort({ _id: -1 }) 
            .skip((page - 1) * limit) 
            .limit(limit); // ✅ এটি নিশ্চিত করবে যে ২০টির বেশি ডাটা যাবে না

        res.json({
            products,
            totalProducts: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });

    } catch (error) {
        console.error("Product Fetch Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

// 🔥 2. GET SINGLE PRODUCT (Optimized for Speed)
// 🔥 2. GET SINGLE PRODUCT (DEBUG VERSION)
router.get('/:id', async (req, res) => {
    console.log(`🔍 Request received for Product ID: ${req.params.id}`); // লগ ১
    
    try {
        const productId = req.params.id;
        
        // ১. মেইন প্রোডাক্ট খোঁজা
        const product = await Product.findById(productId);
        console.log("✅ Main Product Found"); // লগ ২

        if (!product) {
            console.log("❌ Product is NULL");
            return res.status(404).json({ message: "Product not found" });
        }

        // ⚠️ টেস্ট: রিলেটেড প্রোডাক্ট লজিক সাময়িকভাবে বন্ধ রাখা হলো
        // যদি এটা বন্ধ করলে লোডিং চলে যায়, তবে বুঝব সমস্যা এখানেই।
        /*
        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: product._id }
        }).limit(4);
        */
        
        const relatedProducts = []; // খালি অ্যারে পাঠাচ্ছি টেস্টের জন্য

        console.log("🚀 Sending Response..."); // লগ ৩
        
        // রেসপন্স পাঠানো
        res.json({ product, relatedProducts });

    } catch (error) {
        console.error("💥 CRITICAL ERROR:", error); // এরর লগ
        res.status(500).json({ message: "Server Error" });
    }
});

// 🔥 3. ADD NEW PRODUCT
router.post('/', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (error) {
        res.status(400).json({ message: "Failed to add product", error: error.message });
    }
});

// 🔥 4. UPDATE PRODUCT
router.put('/:id', async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true } 
        );
        res.json(updatedProduct);
    } catch (error) {
        res.status(500).json({ message: "Update Failed" });
    }
});

// 🔥 5. DELETE PRODUCT
router.delete('/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Product deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Delete Failed" });
    }
});

module.exports = router;