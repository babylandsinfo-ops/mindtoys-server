const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mindtoys')
    .then(() => console.log("✅ MongoDB Connected Successfully"))
    .catch(err => console.log("❌ MongoDB Connection Error:", err));


// ================= SCHEMAS & MODELS ================= //

// 📦 1. Product Schema
// 📦 1. Product Schema (Updated)
const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true }, // ডাটাবেসে price নাম্বার হিসেবেই আছে
    category: String,
    description: String,
    image: String,
    sourceUrl: String,
    qty: Number,
    date: { type: Date, default: Date.now }
}, { strict: false }); // strict: false দিলে সব ডাটা আসবে

// 🔥 FIX: 'products' শব্দটি ৩য় প্যারামিটার হিসেবে দেওয়া হলো।
// এতে Mongoose অন্য কোনো নাম না খুঁজে সরাসরি 'products' কালেকশন থেকে ডাটা আনবে।
const Product = mongoose.model('Product', productSchema, 'products');

// 🛒 2. Order Schema (Flexible for Old & New Data)
const orderSchema = new mongoose.Schema({
    // Customer Info (Supports both structures)
    name: String, 
    phone: String,
    address: String,
    customerDetails: {
        name: String,
        phone: String,
        address: String
    },

    // Cart Items (Supports 'items', 'cartItems', 'cart')
    items: Array,
    cartItems: Array,
    cart: Array,

    // Payment & Status
    totalAmount: Number,
    total: Number,
    status: { type: String, default: 'Pending' }, // Pending, Shipped, Delivered, Cancelled
    orderDate: { type: Date, default: Date.now },
    date: { type: Date, default: Date.now },

    // 🔥 Importer Ledger (Profit Tracking)
    buyingPrice: { type: Number, default: 0 },
    isImporterPaid: { type: Boolean, default: false }
}, { strict: false }); // strict: false allows saving extra fields if needed

const Order = mongoose.model('Order', orderSchema);


// ================= ROUTES ================= //

// ---------------- PRODUCT ROUTES ---------------- //

// ১. সব প্রোডাক্ট দেখা (GET)
app.get('/api/products', async (req, res) => {
    try {
        // নতুন প্রোডাক্ট আগে দেখাবে
        const products = await Product.find().sort({ date: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ২. নতুন প্রোডাক্ট অ্যাড করা (POST)
app.post('/api/products', async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ৩. প্রোডাক্ট আপডেট/এডিট করা (PUT) - 🔥 NEW
app.put('/api/products/:id', async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true } // আপডেট হওয়ার পর নতুন ডাটা রিটার্ন করবে
        );
        res.json(updatedProduct);
    } catch (err) {
        res.status(500).json({ message: "Update Failed" });
    }
});

// ৪. প্রোডাক্ট ডিলিট করা (DELETE) - 🔥 NEW
app.delete('/api/products/:id', async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ message: "Product Deleted Successfully" });
    } catch (err) {
        res.status(500).json({ message: "Delete Failed" });
    }
});


// ---------------- ORDER ROUTES ---------------- //

// ৫. নতুন অর্ডার প্লেস করা (POST)
app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        const savedOrder = await newOrder.save();
        res.status(201).json(savedOrder);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ৬. সব অর্ডার দেখা (GET)
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ orderDate: -1, date: -1 });
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ৭. অর্ডার স্ট্যাটাস আপডেট করা (PUT)
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

// ৮. ইম্পোর্টার লেজার আপডেট করা (PUT) - 🔥 PROFIT TRACKING
app.put('/api/orders/:id/importer-info', async (req, res) => {
    try {
        const { buyingPrice, isImporterPaid } = req.body;
        const updateData = {};
        
        // শুধু ভ্যালিড ডাটা আপডেট হবে
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