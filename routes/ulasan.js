const express = require('express');
const router = express.Router();
const Ulasan = require('../models/ulasan');

// Cache mechanism to reduce database load
let cachedUlasan = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 1 minute cache

// 📥 Get all reviews with caching
router.get('/', async (req, res) => {
  try {
    const currentTime = Date.now();
    
    // Use cached data if available and fresh
    if (cachedUlasan && currentTime - lastFetchTime < CACHE_DURATION) {
      return res.json(cachedUlasan);
    }
    
    // Log to server console that we're fetching from database
    console.log('Fetching ulasan from database...');
    
    // Actual database query with timeout handled at the MongoDB connection level
    const ulasan = await Ulasan.find();
    
    // Update cache
    cachedUlasan = ulasan;
    lastFetchTime = currentTime;
    
    res.json(ulasan);
  } catch (err) {
    console.error('Error in GET /api/ulasan:', err);
    
    // If we have cached data, return it even if it's stale
    if (cachedUlasan) {
      console.log('Returning stale cached data due to error');
      return res.json(cachedUlasan);
    }
    
    // Otherwise return an error
    res.status(500).json({ 
      error: 'Gagal mengambil ulasan',
      message: err.message 
    });
  }
});

// 📥 Get reviews by product name with caching
router.get('/produk/:nama_produk', async (req, res) => {
  try {
    const namaProduk = req.params.nama_produk;
    
    // Use regex for case-insensitive search
    const ulasan = await Ulasan.find({
      produk: { $regex: new RegExp(namaProduk, 'i') },
    }).limit(50);
    
    res.json(ulasan);
  } catch (err) {
    console.error('Error in GET /api/ulasan/produk/:nama_produk:', err);
    res.status(500).json({ 
      error: 'Gagal mengambil ulasan untuk produk tersebut',
      message: err.message 
    });
  }
});

// 📥 Get reviews by rating
router.get('/rating/:rating', async (req, res) => {
  try {
    const rating = parseInt(req.params.rating);
    
    // Validate rating
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating harus berupa angka 1-5' });
    }
    
    const ulasan = await Ulasan.find({ rating: rating });
    res.json(ulasan);
  } catch (err) {
    console.error('Error in GET /api/ulasan/rating/:rating:', err);
    res.status(500).json({ 
      error: 'Gagal mengambil ulasan berdasarkan rating',
      message: err.message 
    });
  }
});

// ➕ Add a new review
router.post('/', async (req, res) => {
  const { pengguna, produk, rating, komentar, link } = req.body;

  // Validate data
  if (!pengguna || !produk || !rating || !komentar) {
    return res.status(400).json({ error: 'Data ulasan tidak lengkap' });
  }

  try {
    const ulasanBaru = new Ulasan({ 
      pengguna, 
      produk, 
      rating, 
      komentar, 
      link 
    });
    
    // Save to database
    await ulasanBaru.save();
    
    // Invalidate cache so next get will refresh
    cachedUlasan = null;
    
    res.status(201).json(ulasanBaru);
  } catch (err) {
    console.error('Error in POST /api/ulasan:', err);
    res.status(400).json({ 
      error: 'Gagal menambah ulasan',
      message: err.message 
    });
  }
});

// ❌ Delete a review
router.delete('/:id', async (req, res) => {
  try {
    const result = await Ulasan.findByIdAndDelete(req.params.id);
    
    if (!result) {
      return res.status(404).json({ error: 'Ulasan tidak ditemukan' });
    }
    
    // Invalidate cache
    cachedUlasan = null;
    
    res.json({ message: 'Ulasan berhasil dihapus' });
  } catch (err) {
    console.error('Error in DELETE /api/ulasan/:id:', err);
    res.status(400).json({ 
      error: 'Gagal hapus ulasan',
      message: err.message 
    });
  }
});

module.exports = router;