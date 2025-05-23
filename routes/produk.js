const express = require('express');
const router = express.Router();
const Produk = require('../models/produk');
const Ulasan = require('../models/ulasan');
const Sentimen = require('../models/sentimen');

// 🔍 Search & Filter Produk
router.get('/', async (req, res) => {
  const { q, harga_min, harga_max, ukuran, kondisi } = req.query;
  let query = {};

  if (q) query.nama_produk = { $regex: q, $options: 'i' };
  if (ukuran) query.ukuran = ukuran;
  if (kondisi) query.kondisi = kondisi;
  if (harga_min || harga_max) {
    query.harga = {};
    if (harga_min) query.harga.$gte = parseInt(harga_min);
    if (harga_max) query.harga.$lte = parseInt(harga_max);
  }

  try {
    const produk = await Produk.find(query);
    res.json(produk);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data produk' });
  }
});

// ⭐ Endpoint Rekomendasi Produk
router.get('/rekomendasi', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50; // default to 50
    const produk = await Produk.find().sort({ terjual: -1 }).limit(limit);
    res.json(produk);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil produk rekomendasi' });
  }
});

// ➕ Tambah produk
router.post('/', async (req, res) => {
  try {
    const produk = new Produk(req.body);
    await produk.save();
    res.status(201).json(produk);
  } catch (err) {
    res.status(400).json({ error: 'Gagal menambah produk' });
  }
});

// ✏️ Update produk
router.put('/:id', async (req, res) => {
  try {
    const produk = await Produk.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(produk);
  } catch (err) {
    res.status(400).json({ error: 'Gagal update produk' });
  }
});

// ❌ Hapus produk
router.delete('/:id', async (req, res) => {
  try {
    await Produk.findByIdAndDelete(req.params.id);
    res.json({ message: 'Produk berhasil dihapus' });
  } catch (err) {
    res.status(400).json({ error: 'Gagal hapus produk' });
  }
});

// ⭐ Rata-rata rating berdasarkan Nama Produk
router.get('/:nama_produk/rating', async (req, res) => {
  try {
    const ulasan = await Ulasan.find({ produk: req.params.nama_produk });
    const total = ulasan.reduce((sum, u) => sum + u.rating, 0);
    const rataRata = ulasan.length ? total / ulasan.length : 0;
    res.json({ rating: rataRata.toFixed(3) });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghitung rating' });
  }
});

/**
 * @route   GET /api/produk/count
 * @desc    Mendapatkan jumlah produk
 * @access  Public
 */
router.get('/count', async (req, res) => {
  try {
    const count = await Produk.countDocuments();
    res.json({ count });
  } catch (err) {
    console.error('Error counting products:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/produk/:id
 * @desc    Mendapatkan produk berdasarkan ID
 * @access  Public
 */
router.get('/detail/:id', async (req, res) => {
  try {
    // Produk ID di MongoDB adalah numeric, jadi kita parse sebagai number
    const produkId = parseInt(req.params.id);
    const produk = await Produk.findOne({ product_id: produkId });
    
    if (!produk) {
      return res.status(404).json({ message: 'Produk tidak ditemukan' });
    }
    
    res.json(produk);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/produk/:id/reviews
 * @desc    Mendapatkan ulasan untuk produk tertentu
 * @access  Public
 */
router.get('/:id/reviews', async (req, res) => {
  try {
    const produkId = parseInt(req.params.id);
    
    // Cari semua ulasan untuk produk ini
    const ulasan = await Sentimen.find({ produkId })
      .sort({ createdAt: -1 });
    
    res.json(ulasan);
  } catch (err) {
    console.error('Error fetching product reviews:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/produk/top-rated
 * @desc    Mendapatkan produk dengan rating tertinggi
 * @access  Public
 */
router.get('/top-rated', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    
    // Di schema, rating disimpan sebagai string, jadi kita perlu convert dan sort
    const topRatedProduk = await Produk.find()
      .sort({ rating: -1 })
      .limit(limit);
    
    res.json(topRatedProduk);
  } catch (err) {
    console.error('Error fetching top rated products:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/produk/with-sentiments
 * @desc    Mendapatkan produk dengan sentimen
 * @access  Public
 */
router.get('/with-sentiments', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Aggregate untuk mendapatkan produk dan sentimen count
    const produkWithSentiments = await Produk.aggregate([
      {
        $lookup: {
          from: 'ds_sentimen',
          localField: 'product_id',
          foreignField: 'produkId',
          as: 'sentiments'
        }
      },
      {
        $addFields: {
          sentimentCount: { $size: '$sentiments' },
          positiveCount: {
            $size: {
              $filter: {
                input: '$sentiments',
                as: 'sentiment',
                cond: { $eq: ['$$sentiment.label', 'positive'] }
              }
            }
          },
          negativeCount: {
            $size: {
              $filter: {
                input: '$sentiments',
                as: 'sentiment',
                cond: { $eq: ['$$sentiment.label', 'negative'] }
              }
            }
          },
          neutralCount: {
            $size: {
              $filter: {
                input: '$sentiments',
                as: 'sentiment',
                cond: { $eq: ['$$sentiment.label', 'neutral'] }
              }
            }
          }
        }
      },
      {
        $project: {
          product_id: 1,
          nama_produk: 1,
          kategori: 1,
          harga: 1,
          rating: 1,
          "link_Gambar 1": 1,
          sentimentCount: 1,
          positiveCount: 1,
          negativeCount: 1,
          neutralCount: 1,
          positivePercentage: {
            $cond: [
              { $eq: ['$sentimentCount', 0] },
              0,
              { $multiply: [{ $divide: ['$positiveCount', '$sentimentCount'] }, 100] }
            ]
          },
          negativePercentage: {
            $cond: [
              { $eq: ['$sentimentCount', 0] },
              0,
              { $multiply: [{ $divide: ['$negativeCount', '$sentimentCount'] }, 100] }
            ]
          }
        }
      },
      { $match: { sentimentCount: { $gt: 0 } } },
      { $sort: { sentimentCount: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);
    
    // Count total untuk pagination
    const total = await Produk.aggregate([
      {
        $lookup: {
          from: 'ds_sentimen',
          localField: 'product_id',
          foreignField: 'produkId',
          as: 'sentiments'
        }
      },
      {
        $addFields: {
          sentimentCount: { $size: '$sentiments' }
        }
      },
      { $match: { sentimentCount: { $gt: 0 } } },
      { $count: 'total' }
    ]);
    
    res.json({
      data: produkWithSentiments,
      pagination: {
        total: total.length > 0 ? total[0].total : 0,
        page,
        totalPages: Math.ceil((total.length > 0 ? total[0].total : 0) / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching products with sentiments:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;