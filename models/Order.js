const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // কাস্টমার ইনফো
  customerDetails: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
  },
  // কার্ট আইটেম
  cartItems: [
    {
      id: String,
      name: String,
      price: Number, // Selling Price (কাস্টমার যা দেখছে)
      image: String,
      quantity: Number,
    }
  ],
  totalAmount: { type: Number, required: true }, // Total Selling Price
  
  // অর্ডার স্ট্যাটাস
  status: { type: String, default: 'Pending' }, 
  date: { type: Date, default: Date.now },

  // ✅ নতুন সেকশন: ইম্পোর্টার ও লাভের হিসাব (Importer Logic)
  buyingPrice: { type: Number, default: 0 }, // ইম্পোর্টার থেকে কেনার দাম
  isImporterPaid: { type: Boolean, default: false } // ইম্পোর্টারকে টাকা পরিশোধ হয়েছে কিনা
});

module.exports = mongoose.model('Order', orderSchema);