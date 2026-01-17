const express = require('express');
const router = express.Router();
const Product = require('../models/Product'); // মডেল ইমপোর্ট (পাথ চেক করুন)

// 🔥 1. GET ALL PRODUCTS (With Filter, Search & Pagination)
// URL: /api/products?page=1&category=Toys&search=car
router.get('/', async (req, res) => {
    try {
        // ১. ফ্রন্টএন্ড থেকে প্যারামিটার ধরা
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const category = req.query.category || '';
        const search = req.query.search || '';
        const minPrice = parseInt(req.query.minPrice) || 0;
        const maxPrice = parseInt(req.query.maxPrice) || 1000000;

        // ২. কুয়েরি (Query) তৈরি করা
        let query = {};

        // ক্যাটাগরি ফিল্টার (যদি 'All' না হয়)
        if (category && category !== 'All') {
            // হুবহু ম্যাচ করার জন্য (Case Insensitive হলে ভালো, তবে এখানে Exact Match রাখা হলো)
            query.category = category;
        }

        // সার্চ ফিল্টার (Regex ব্যবহার করে আংশিক নামের সাথে মিললেও আসবে)
        if (search) {
            query.name = { $regex: search, $options: 'i' }; 
        }

        // প্রাইস ফিল্টার (অপশনাল)
        if (req.query.minPrice || req.query.maxPrice) {
            query.price = { $gte: minPrice, $lte: maxPrice };
        }

        // ৩. মোট কতগুলো প্রোডাক্ট আছে তা গোনা (Pagination এর জন্য জরুরি)
        const total = await Product.countDocuments(query);

        // ৪. ডাটাবেস থেকে ডাটা আনা (Skip & Limit লজিক)
        const products = await Product.find(query)
            .sort({ _id: -1 }) // একদম নতুন প্রোডাক্ট আগে দেখাবে (Latest First)
            .skip((page - 1) * limit) // আগের পেজের ডাটা বাদ দেওয়া
            .limit(limit);            // নির্দিষ্ট সংখ্যক ডাটা নেওয়া

        // ৫. রেসপন্স পাঠানো (Frontend এই ফরম্যাট আশা করছে)
        res.json({
            products,       // প্রোডাক্ট অ্যারে
            totalProducts: total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });

    } catch (error) {
        console.error("Product Fetch Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

// 🔥 2. GET SINGLE PRODUCT (Product Details Page এর জন্য)
// URL: /api/products/65a1b2c3d4...
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: "Product not found" });
        }
    } catch (error) {
        console.error("Single Product Error:", error);
        res.status(500).json({ message: "Server Error" });
    }
});

// 🔥 3. ADD NEW PRODUCT (Admin Panel এর জন্য)
// URL: POST /api/products
router.post('/', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (error) {
        res.status(400).json({ message: "Failed to add product", error: error.message });
    }
});

// 🔥 4. UPDATE PRODUCT (যদি ভবিষ্যতে এডিট করতে চান)
router.put('/:id', async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true } // আপডেটেড ডাটা রিটার্ন করবে
        );
        res.json(updatedProduct);
    } catch (error) {
        res.status(500).json({ message: "Update Failed" });
    }
});

// 🔥 5. DELETE PRODUCT (অ্যাডমিন ডিলিট করতে চাইলে)
router.delete('/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Product deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Delete Failed" });
    }
});

module.exports = router;