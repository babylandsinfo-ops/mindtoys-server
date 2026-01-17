const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// ✅ অর্ডার স্কিমা আপডেট করা হলো (Importer-এর হিসাব সহ)
const orderSchema = new mongoose.Schema({
    name: String,
    phone: String,
    address: String,
    city: String,
    note: String,
    cart: Array,
    total: Number,
    status: { type: String, default: 'Pending' }, 
    date: { type: Date, default: Date.now },

    // 🔥 নতুন ফিল্ড (ইম্পোর্টার ও লাভের হিসাব)
    buyingPrice: { type: Number, default: 0 }, // ইম্পোর্টার থেকে কেনার দাম
    isImporterPaid: { type: Boolean, default: false } // ইম্পোর্টারকে টাকা পরিশোধ হয়েছে কিনা
});

// মডেল তৈরি (আগের মডেল থাকলে সেটা ব্যবহার করবে, না হলে নতুন তৈরি করবে)
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

// ১. নতুন অর্ডার তৈরি করা (Customer)
router.post('/', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        const savedOrder = await newOrder.save();
        res.status(201).json(savedOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ২. সব অর্ডার দেখা (Admin)
router.get('/', async (req, res) => {
    try {
        const orders = await Order.find().sort({ date: -1 }); // লেটেস্ট অর্ডার আগে
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// ৩. অর্ডার স্ট্যাটাস আপডেট করা (Pending -> Shipped -> Delivered)
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { status: status },
            { new: true }
        );
        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ message: "Status Update Failed" });
    }
});

// 🔥 ৪. ইম্পোর্টার ডিটেইলস আপডেট করা (নতুন ফিচার)
router.put('/:id/importer-info', async (req, res) => {
    try {
        const { buyingPrice, isImporterPaid } = req.body;
        const updateData = {};
        
        // শুধু যেটা পাঠানো হবে সেটাই আপডেট হবে
        if (buyingPrice !== undefined) updateData.buyingPrice = Number(buyingPrice);
        if (isImporterPaid !== undefined) updateData.isImporterPaid = isImporterPaid;

        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        );
        res.json(updatedOrder);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Importer Info Update Failed" });
    }
});

module.exports = router;