import mongoose from "mongoose";

import { connectDatabase } from "../config/database.js";
import Category from "../models/category.model.js";
import Product from "../models/product.model.js";

const categories = [
  {
    name: "Smartphones",
    slug: "smartphones",
    description: "New mobile phones for everyday use, photography, gaming, and work.",
  },
];

const products = [
  {
    name: "Galaxy Aura 5G",
    slug: "galaxy-aura-5g",
    brand: "Samsung",
    description: "A balanced 5G smartphone for everyday photos, streaming, study, and work.",
    highlights: ["50 MP main camera", "120 Hz AMOLED display", "5000 mAh battery", "5G ready"],
    specifications: {
      display: "6.6-inch AMOLED, 120 Hz",
      processor: "Octa-core 5G processor",
      ram: "8 GB",
      camera: "50 MP + ultra-wide camera",
      battery: "5000 mAh, fast charging",
      operatingSystem: "Android",
      network: "5G, 4G, Wi-Fi, Bluetooth",
      warranty: "1 year manufacturer warranty",
    },
    images: ["https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=900&q=80"],
    variants: [
      {
        color: "Navy Blue",
        storage: "128 GB",
        sku: "MMS-GA5-NB-128",
        pricePaise: 2899900,
        originalPricePaise: 3199900,
        stock: 14,
        imageUrl: "https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=900&q=80",
      },
    ],
    averageRating: 4.4,
    reviewCount: 126,
    isFeatured: true,
    isActive: true,
  },
  {
    name: "iPhone Nova",
    slug: "iphone-nova",
    brand: "Apple",
    description: "A premium phone with a bright display, strong cameras, and a reliable all-day experience.",
    highlights: ["Advanced dual-camera system", "Super Retina display", "Fast performance", "USB-C charging"],
    specifications: {
      display: "6.1-inch OLED display",
      processor: "High-performance mobile chip",
      ram: "6 GB",
      camera: "48 MP main camera + ultra-wide",
      battery: "All-day battery life",
      operatingSystem: "iOS",
      network: "5G, 4G, Wi-Fi, Bluetooth",
      warranty: "1 year manufacturer warranty",
    },
    images: ["https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80"],
    variants: [
      {
        color: "Midnight",
        storage: "128 GB",
        sku: "MMS-IN-MN-128",
        pricePaise: 6999900,
        originalPricePaise: 7499900,
        stock: 8,
        imageUrl: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80",
      },
    ],
    averageRating: 4.7,
    reviewCount: 214,
    isFeatured: true,
    isActive: true,
  },
  {
    name: "Nord Pulse 5G",
    slug: "nord-pulse-5g",
    brand: "OnePlus",
    description: "A smooth and quick everyday phone designed for fast charging and fluid performance.",
    highlights: ["100 W fast charging", "120 Hz display", "50 MP camera", "Clean Android experience"],
    specifications: {
      display: "6.7-inch AMOLED, 120 Hz",
      processor: "Snapdragon 5G processor",
      ram: "8 GB",
      camera: "50 MP main camera",
      battery: "5000 mAh, 100 W charging",
      operatingSystem: "Android",
      network: "5G, 4G, Wi-Fi, Bluetooth",
      warranty: "1 year manufacturer warranty",
    },
    images: ["https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=900&q=80"],
    variants: [
      {
        color: "Glacier Silver",
        storage: "256 GB",
        sku: "MMS-NP5-GS-256",
        pricePaise: 3299900,
        originalPricePaise: 3599900,
        stock: 11,
        imageUrl: "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=900&q=80",
      },
    ],
    averageRating: 4.5,
    reviewCount: 93,
    isFeatured: false,
    isActive: true,
  },
  {
    name: "Pixel Vision",
    slug: "pixel-vision",
    brand: "Google",
    description: "A camera-focused phone with helpful software features and a clean, simple Android experience.",
    highlights: ["Smart photo tools", "50 MP camera", "Bright OLED display", "Wireless charging"],
    specifications: {
      display: "6.3-inch OLED display",
      processor: "Google-designed mobile chip",
      ram: "8 GB",
      camera: "50 MP main camera + ultra-wide",
      battery: "4700 mAh, wireless charging",
      operatingSystem: "Android",
      network: "5G, 4G, Wi-Fi, Bluetooth",
      warranty: "1 year manufacturer warranty",
    },
    images: ["https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=80"],
    variants: [
      {
        color: "Porcelain",
        storage: "128 GB",
        sku: "MMS-PV-PC-128",
        pricePaise: 5499900,
        originalPricePaise: 5999900,
        stock: 6,
        imageUrl: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=80",
      },
    ],
    averageRating: 4.6,
    reviewCount: 81,
    isFeatured: true,
    isActive: true,
  },
  {
    name: "Edge Fusion",
    slug: "edge-fusion",
    brand: "Motorola",
    description: "A slim, durable phone with a smooth screen and dependable camera for daily use.",
    highlights: ["Curved 144 Hz display", "50 MP camera", "Water-resistant design", "Fast charging"],
    specifications: {
      display: "6.7-inch pOLED, 144 Hz",
      processor: "Snapdragon 5G processor",
      ram: "12 GB",
      camera: "50 MP main camera + ultra-wide",
      battery: "5000 mAh, fast charging",
      operatingSystem: "Android",
      network: "5G, 4G, Wi-Fi, Bluetooth",
      warranty: "1 year manufacturer warranty",
    },
    images: ["https://images.unsplash.com/photo-1605236453806-6ff36851218e?auto=format&fit=crop&w=900&q=80"],
    variants: [
      {
        color: "Forest Green",
        storage: "256 GB",
        sku: "MMS-EF-FG-256",
        pricePaise: 2799900,
        originalPricePaise: 3099900,
        stock: 9,
        imageUrl: "https://images.unsplash.com/photo-1605236453806-6ff36851218e?auto=format&fit=crop&w=900&q=80",
      },
    ],
    averageRating: 4.3,
    reviewCount: 68,
    isFeatured: false,
    isActive: true,
  },
  {
    name: "Redmi Note Spark",
    slug: "redmi-note-spark",
    brand: "Xiaomi",
    description: "A value-focused 5G phone with a large battery, detailed camera, and plenty of storage.",
    highlights: ["108 MP main camera", "Large 5000 mAh battery", "120 Hz display", "Fast charging"],
    specifications: {
      display: "6.67-inch AMOLED, 120 Hz",
      processor: "Snapdragon 5G processor",
      ram: "8 GB",
      camera: "108 MP main camera",
      battery: "5000 mAh, fast charging",
      operatingSystem: "Android",
      network: "5G, 4G, Wi-Fi, Bluetooth",
      warranty: "1 year manufacturer warranty",
    },
    images: ["https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=900&q=80"],
    variants: [
      {
        color: "Aurora Purple",
        storage: "256 GB",
        sku: "MMS-RNS-AP-256",
        pricePaise: 2299900,
        originalPricePaise: 2499900,
        stock: 16,
        imageUrl: "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=900&q=80",
      },
    ],
    averageRating: 4.2,
    reviewCount: 117,
    isFeatured: false,
    isActive: true,
  },
];

const seedProducts = async () => {
  await connectDatabase();

  const categoryBySlug = new Map();
  for (const category of categories) {
    const savedCategory = await Category.findOneAndUpdate(
      { slug: category.slug },
      { $set: category },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    categoryBySlug.set(category.slug, savedCategory._id);
  }

  for (const product of products) {
    const { categorySlug = "smartphones", ...productData } = product;
    await Product.findOneAndUpdate(
      { slug: product.slug },
      { $set: { ...productData, category: categoryBySlug.get(categorySlug) } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  console.log(`Added or updated ${products.length} MobileMart demo phones.`);
};

seedProducts()
  .catch((error) => {
    console.error("Unable to seed products:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
