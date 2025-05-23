const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import models
const Produk = require('./models/produk');
const Ulasan = require('./models/ulasan');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB terkoneksi'))
.catch((err) => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// Function to clean price format (e.g., "Rp239.000" -> 239000)
const cleanPrice = (price) => {
  if (typeof price === 'number') return price;
  
  if (typeof price === 'string') {
    // Remove "Rp" prefix and any dots or commas
    return parseInt(price.replace(/[Rp\.,]/g, ''));
  }
  
  return 0; // Default value if price is invalid
};

// Function to ensure stock is a number
const cleanStock = (stock) => {
  if (typeof stock === 'number') return stock;
  
  if (typeof stock === 'string') {
    return parseInt(stock.replace(/\D/g, '')) || 0;
  }
  
  return 0; // Default value if stock is invalid
};

// Function to import data
const importData = async () => {
  try {
    // Read JSON files
    const produkData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'json', 'Dataset_produk_Erigo.json'), 'utf-8')
    );
    
    const ulasanData = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'data', 'json', 'Dataset_ulasan_Erigo.json'), 'utf-8')
    );

    // Clear existing data
    await Produk.deleteMany({});
    await Ulasan.deleteMany({});
    console.log('🗑️ Data lama dihapus');

    // Clean and transform product data
    const cleanedProdukData = produkData.map(item => ({
      ...item,
      Harga: cleanPrice(item.Harga),
      Stok: cleanStock(item.Stok),
      Rating: typeof item.Rating === 'number' ? item.Rating : parseFloat(item.Rating) || 0
    }));

    // Import produk data
    await Produk.insertMany(cleanedProdukData);
    console.log(`✅ ${cleanedProdukData.length} produk berhasil diimpor`);

    // Clean and transform review data
    const cleanedUlasanData = ulasanData.map(item => ({
      ...item,
      Rating: typeof item.Rating === 'number' ? item.Rating : parseFloat(item.Rating) || 0
    }));

    // Import ulasan data
    await Ulasan.insertMany(cleanedUlasanData);
    console.log(`✅ ${cleanedUlasanData.length} ulasan berhasil diimpor`);

    console.log('🎉 Import data selesai!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error saat import data:', err);
    process.exit(1);
  }
};

// Run import
importData();
