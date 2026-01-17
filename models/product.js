const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true // নাম থাকতেই হবে
  },
  price: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String, // এখানে ছবির লিংক থাকবে (Cloudinary)
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['kids', 'special_needs', 'educational'] // শুধু এই ৩ ধরনের ক্যাটাগরি হবে
  },
  inStock: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // অটোমেটিক তৈরি এবং আপডেটের সময় সেভ হবে
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;