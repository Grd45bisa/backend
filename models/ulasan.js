const mongoose = require('mongoose');

const ulasanSchema = new mongoose.Schema({
  produk_id: String,
  pengguna: String,
  produk: String,
  rating: Number,
  komentar: String,
  link: String
});

module.exports = mongoose.model('ds_ulasan', ulasanSchema, 'ds_ulasan');