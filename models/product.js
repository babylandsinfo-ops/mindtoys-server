const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: false // ডেসক্রিপশন না থাকলেও যেন সমস্যা না করে
  },
  image: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    index: true // 🚀 স্পিডের জন্য এটা থাকতেই হবে
    // ❌ enum লাইনটি সম্পূর্ণ বাদ দেওয়া হয়েছে
  },
  qty: { 
    type: Number, 
    default: 20 
  },
  inStock: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true 
});

// সার্চ ইনডেক্স
productSchema.index({ name: 'text' }); 

// মডেল এক্সপোর্ট
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
module.exports = Product;