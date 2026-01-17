const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// ================= MIDDLEWARE ================= //
app.use(cors());
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
    skills: [String],      // Skills array (Optional)
    ageRange: String,      // Age range (Optional)
    date: { type: Date, default: Date.now }
}, { strict: false });

// Model definition with explicit collection name 'products'
const Product = mongoose.model('Product', productSchema, 'products');

// 🛒 2. Order Schema
const orderSchema = new mongoose.Schema({
    // Customer Info
    name: String, 
    phone: String,
    address: String,
    customerDetails: {
        name: String,
        phone: String,
        address: String
    },

    // Cart Items
    items: Array,
    cartItems: Array,
    cart: Array,

    // Payment & Status
    totalAmount: Number,
    total: Number,
    status: { type: String, default: 'Pending' },
    orderDate: { type: Date, default: Date.now },
    date: { type: Date, default: Date.now },

    // Importer Ledger (Profit Tracking)
    buyingPrice: { type: Number, default: 0 },
    isImporterPaid: { type: Boolean, default: false }
}, { strict: false });

const Order = mongoose.model('Order', orderSchema);


// ================= ROUTES ================= //

// ---------------- PRODUCT ROUTES ---------------- //

// ১. সব প্রোডাক্ট দেখা (Pagination & Filter সহ - সুপারফাস্ট) 🚀
app.get('/api/products', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20; 
        const category = req.query.category;

        let query = {};
        if (category && category !== 'All') {
            query.category = category;
        }

        const products = await Product.find(query)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 }) // নতুন প্রোডাক্ট আগে
            .exec();

        const count = await Product.countDocuments(query);

        res.json({
            products,
            totalPages: Math.ceil(count / limit),
            currentPage: page,
            totalProducts: count
        });

    } catch (err) {
        console.error("Error fetching products:", err);
        res.status(500).json({ message: "Server Error" });
    }
});

// ২. নির্দিষ্ট একটি প্রোডাক্ট দেখা (Single Product Details) 🔍
app.get('/api/products/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });
        res.json(product);
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

// ৪. প্রোডাক্ট আপডেট/এডিট করা (PUT)
app.put('/api/products/:id', async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true }
        );
        res.json(updatedProduct);
    } catch (err) {
        res.status(500).json({ message: "Update Failed" });
    }
});

// ৫. প্রোডাক্ট ডিলিট করা (DELETE)
app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Product Deleted Successfully" });
    } catch (err) {
        res.status(500).json({ message: "Delete Failed" });
    }
});


// ---------------- ORDER ROUTES ---------------- //

// ৬. নতুন অর্ডার প্লেস করা (POST)
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

// ৮. অর্ডার স্ট্যাটাস আপডেট করা (PUT)
app.put('/api/orders/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { status: status },
            { new: true }
        );
        res.json(updatedOrder);
    } catch (err) {
        res.status(500).json({ message: "Status Update Failed" });
    }
});

// ৯. ইম্পোর্টার লেজার আপডেট করা (PUT)
app.put('/api/orders/:id/importer-info', async (req, res) => {
    try {
        const { buyingPrice, isImporterPaid } = req.body;
        const updateData = {};
        
        if (buyingPrice !== undefined) updateData.buyingPrice = Number(buyingPrice);
        if (isImporterPaid !== undefined) updateData.isImporterPaid = isImporterPaid;

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
        
        if (!updatedOrder) return res.status(404).json({ message: "Order not found" });
        res.json(updatedOrder);
    } catch (err) {
        console.error("Ledger Error:", err);
        res.status(500).json({ message: "Ledger Update Failed" });
    }
});

// ================= SERVER START ================= //

app.get('/', (req, res) => {
    res.send('🚀 MindToys Server is Running...');
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});