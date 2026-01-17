const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ================= 🔥 FIXED MIDDLEWARE (CORS) ================= //
// আমরা এখানে বলে দিচ্ছি: "সব ধরনের রিকোয়েস্ট অ্যালাও করো"
// 🔥 CORS CONFIGURATION (Bulletproof Fix)
// আমরা নির্দিষ্ট করে বলে দিচ্ছি কোন কোন ডোমেইন এলাউড
const allowedOrigins = [
    'http://localhost:5173', // আপনার লোকাল কম্পিউটার
    'https://maroon-alligator-397620.hostingersite.com' // 👈 আপনার লাইভ সাইট
];

app.use(cors({
    origin: function (origin, callback) {
        // (!origin) মানে হলো যদি সার্ভার নিজেই নিজেকে কল করে (যেমন Postman বা Server to Server)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log("🚫 Blocked by CORS:", origin); // কনসোলে দেখাবে কে ব্লক হলো
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());


// ================= DATABASE CONNECTION ================= //
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mindtoys')
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch(err => console.log("❌ MongoDB Connection Error:", err));

// ================= SCHEMAS & MODELS ================= //

// 📦 1. Product Schema
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: String,
    description: String,
    image: String,
    sourceUrl: String,
    qty: Number,
    skills: [String],
    ageRange: String,
    date: { type: Date, default: Date.now }
}, { strict: false });

const Product = mongoose.model('Product', productSchema, 'products');

// 🛒 2. Order Schema
const orderSchema = new mongoose.Schema({
    name: String, 
    phone: String,
    address: String,
    customerDetails: {
        name: String,
        phone: String,
        address: String
    },
    items: Array,
    cartItems: Array,
    cart: Array,
    totalAmount: Number,
    total: Number,
    status: { type: String, default: 'Pending' },
    buyingPrice: { type: Number, default: 0 },
    isImporterPaid: { type: Boolean, default: false },
    orderDate: { type: Date, default: Date.now },
    date: { type: Date, default: Date.now }
}, { strict: false });

const Order = mongoose.model('Order', orderSchema);


// ================= ROUTES ================= //

// ১. সব প্রোডাক্ট দেখা (Pagination & Filter সহ) 🚀
app.get('/api/products', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20; 
        
        // 🛠️ FIX: Trim ব্যবহার করা (যাতে 'Toys ' সমস্যা না হয়)
        const category = req.query.category ? req.query.category.trim() : '';
        const search = req.query.search ? req.query.search.trim() : '';

        let query = {};

        // ক্যাটাগরি ফিল্টার
        if (category && category !== 'All') {
            query.category = category;
        }

        // সার্চ ফিল্টার (Regex - Case Insensitive)
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const products = await Product.find(query)
            .sort({ _id: -1 }) // লেটেস্ট প্রোডাক্ট আগে
            .skip((page - 1) * limit)
            .limit(limit);

        const count = await Product.countDocuments(query);

        res.json({
            products, // Array of products
            totalProducts: count,
            totalPages: Math.ceil(count / limit),
            currentPage: page
        });

    } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).json({ message: "Server Error" });
    }
});

// ২. নির্দিষ্ট একটি প্রোডাক্ট দেখা (Single Product) 🔍
// 🔥 FIX: রিলেটেড প্রোডাক্ট সহ পাঠানো (Speed Optimization)
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });

        // রিলেটেড প্রোডাক্ট খোঁজা (একই ক্যাটাগরির ৪টি)
        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: product._id }
        }).limit(4);

        res.json({ product, relatedProducts });
        
    } catch (err) {
        res.status(500).json({ message: "Server Error" });
    }
});

// ৩. নতুন প্রোডাক্ট অ্যাড করা (POST)
app.post('/api/products', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ৪. প্রোডাক্ট আপডেট (PUT)
app.put('/api/products/:id', async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id, req.body, { new: true }
        );
        res.json(updatedProduct);
    } catch (err) {
        res.status(500).json({ message: "Update Failed" });
    }
});

// ৫. প্রোডাক্ট ডিলিট (DELETE)
app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Product Deleted Successfully" });
    } catch (err) {
        res.status(500).json({ message: "Delete Failed" });
    }
});


// ---------------- ORDER ROUTES ---------------- //

// ৬. অর্ডার প্লেস করা (POST)
app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        const savedOrder = await newOrder.save();
        res.status(201).json(savedOrder);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ৭. সব অর্ডার দেখা (GET)
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ orderDate: -1, date: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ৮. অর্ডার স্ট্যাটাস আপডেট (PUT)
app.put('/api/orders/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id, { status: status }, { new: true }
        );
        res.json(updatedOrder);
    } catch (err) {
        res.status(500).json({ message: "Status Update Failed" });
    }
});

// ================= SERVER START ================= //

app.get('/', (req, res) => {
    res.send('🚀 MindToys Server is Running...');
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});