const express = require('express');
const router = express.Router();
const Produk = require('../models/produk');
const Ulasan = require('../models/ulasan');

// Route Statistik
router.get('/', async (req, res) => {
  try {
    const totalProduk = await Produk.countDocuments();
    const totalUlasan = await Ulasan.countDocuments();

    // Cari produk yang paling banyak diulas (berdasarkan Nama_Produk)
    const produkPalingBanyakUlasan = await Ulasan.aggregate([
      {
        $group: {
          _id: "$Nama_Produk",
          jumlahUlasan: { $sum: 1 }
        }
      },
      { $sort: { jumlahUlasan: -1 } },
      { $limit: 1 }
    ]);

    res.json({
      totalProduk,
      totalUlasan,
      produkPalingBanyakUlasan: produkPalingBanyakUlasan[0] || null
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil statistik' });
  }
});

module.exports = router;
