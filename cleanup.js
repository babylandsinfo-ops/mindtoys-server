const mongoose = require('mongoose');
require('dotenv').config();

const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    category: String,
    image: String,
    sourceUrl: String,
    qty: { type: Number, default: 20 }
});

const Product = mongoose.model('Product', productSchema);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected..."))
    .catch(err => console.log(err));

const removeDuplicates = async () => {
    console.log("🧹 Starting Cleanup Operation...");

    const allProducts = await Product.find({});
    console.log(`📊 Total Products Found: ${allProducts.length}`);

    const uniqueNames = new Set();
    const duplicates = [];

    allProducts.forEach(product => {
        // নামগুলো চেক করছি (Space বা ছোট/বড় হাতের অক্ষর ইগনোর করে)
        const normalizedName = product.name.trim().toLowerCase();

        if (uniqueNames.has(normalizedName)) {
            // যদি নামটা আগে দেখে থাকি, তাহলে এটা ডুপ্লিকেট -> ডিলিট লিস্টে যোগ করো
            duplicates.push(product._id);
        } else {
            // নতুন নাম হলে লিস্টে রাখো
            uniqueNames.add(normalizedName);
        }
    });

    console.log(`⚠️ Found ${duplicates.length} duplicate items.`);

    if (duplicates.length > 0) {
        await Product.deleteMany({ _id: { $in: duplicates } });
        console.log("🔥 All duplicates deleted successfully!");
    } else {
        console.log("✅ No duplicates found. Database is clean.");
    }

    // ক্লিন করার পর বর্তমান অবস্থা
    const finalCount = await Product.countDocuments();
    console.log(`🏁 Final Unique Products Count: ${finalCount}`);

    mongoose.connection.close();
};

removeDuplicates();