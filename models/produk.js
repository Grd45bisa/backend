const mongoose = require('mongoose');

const produkSchema = new mongoose.Schema({
  no: Number,
  product_id: Number,
  nama_produk: String,
  kategori: String,
  terjual: String,
  rating: String,
  harga: Number,
  ukuran: String,
  kondisi: String,
  deskripsi: String,
  deskripsi_HTML: String,
  stok: String,
  "link_Gambar 1": String,
  "link_Gambar 2": String,
  "link_Gambar 3": String,
  link: String
});

// Check if the model already exists to prevent compilation errors
module.exports = mongoose.models.Produk || mongoose.model('Produk', produkSchema, 'ds_produk');