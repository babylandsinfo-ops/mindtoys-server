const mongoose = require('mongoose');
require('dotenv').config();

const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    description: String,
    category: String,
    image: String,
    qty: { type: Number, default: 20 }
});

const Product = mongoose.model('Product', productSchema);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected..."))
    .catch(err => console.log(err));

// ✅ সব ইমেজের শেষে .png দেওয়া হয়েছে
const products = [
    {
        name: "12 Colors Soft Super Light Air Dry Clay",
        price: 160,
        description: "Perfect for DIY handmade toys and arts & crafts.",
        category: "Art & Craft",
        image: "/assets/clay.png"  // Changed to .png
    },
    {
        name: "360 Degree Rotating Swing Cute Duck Toy",
        price: 850,
        description: "Interactive musical duck toy with light effects.",
        category: "Toys & Gaming",
        image: "/assets/duck.png" // Changed to .png
    },
    {
        name: "2 in 1 Baby Learning Walkers & Play Panel",
        price: 3850,
        description: "Helps babies learn to walk safely with fun activities.",
        category: "Baby Care",
        image: "/assets/walker.png" // Changed to .png
    },
    {
        name: "Venom God Of War Transformer Robot",
        price: 750,
        description: "Cool action figure that transforms into a car.",
        category: "Toys & Gaming",
        image: "/assets/robot.png" // Changed to .png
    },
    {
        name: "Educational Wooden Puzzle Geometry Shapes",
        price: 550,
        description: "Helps kids learn shapes and colors easily.",
        category: "Developmental Goals",
        image: "/assets/puzzle.png" // Changed to .png
    },
    {
        name: "Kids Musical Xylophone Instrument",
        price: 650,
        description: "Colorful musical instrument for sensory processing.",
        category: "Sensory Processing",
        image: "/assets/xylophone.png" // Changed to .png
    },
    {
        name: "Scientific Magnetic Building Blocks",
        price: 1200,
        description: "Enhances creativity and academic skills.",
        category: "Academic Skills",
        image: "/assets/blocks.png" // Changed to .png
    },
    {
        name: "Soft Baby Pre Walker Shoes - Pink",
        price: 450,
        description: "Comfortable soft shoes for toddlers.",
        category: "Clothes & Footwear",
        image: "/assets/shoes.png" // Changed to .png
    }
];

const seedDB = async () => {
    try {
        await Product.deleteMany({});
        console.log("🧹 Cleared old products...");
        await Product.insertMany(products);
        console.log("🎉 SUCCESS! Local PNG Images Linked.");
    } catch (error) {
        console.error("Error:", error);
    } finally {
        mongoose.connection.close();
    }
};

seedDB();