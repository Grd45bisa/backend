// routes/sentimen.js - API routes untuk ulasan sentimen
const express = require('express');
const router = express.Router();
const UlasanSentimen = require('../models/sentimen');
const Produk = require('../models/produk');
const winston = require('winston');

// Kamus kata positif dalam Bahasa Indonesia
const positiveWords = [
  'bagus', 'pas', 'sesuai', 'pengiriman', 'nyaman', 'cepat', 'banget', 
  'oke', 'baik', 'sampai', 'adem', 'mantap', 'aman', 'sangat', 
  'ok', 'lumayan', 'keren', 'rapi', 'packing', 'tebal', 'cukup', 
  'halus', 'cocok', 'puas', 'berkualitas', 'langganan', 'suka', 
  'diterima', 'rapih', 'original', 'lembut', 'enak', 'ori', 'joss', 
  'mantab', 'tepat', 'datang', 'selamat', 'terbaik', 'terjamin', 'cakep', 
  'bersahabat', 'murah', 'okelah', 'good', 'recommended', 'memuaskan', 
  'ganteng', 'baguss', 'bener', 'gercep', 'kilat', 'terjangkau', 'worth'
];

// Kamus kata negatif dalam Bahasa Indonesia
const negativeWords = [
  'jelek', 'buruk', 'rusak', 'kecewa', 'tidak', 'nggak', 'ga', 'gak', 
  'kurang', 'bau', 'mahal', 'sampah', 'cacat', 'gembel', 'bocor', 'busuk', 
  'kw', 'palsu', 'bohong', 'robek', 'sobek', 'titik', 'noda', 'kotor', 
  'lamban', 'lambat', 'cot', 'telat', 'molor', 'belum', 'pusing', 
  'ribet', 'ngga', 'salah', 'gagal', 'ditunggu', 'abal', 
  'dicuci luntur', 'ditipu', 'kebesaran', 'kekecilan', 'sempit', 'longgar'
];

// Dapatkan logger dari aplikasi utama
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Fungsi untuk mencari kata-kata tertentu dalam teks
function findWords(text, wordList) {
  if (!text || typeof text !== 'string') return [];
  
  const lowerText = text.toLowerCase();
  const foundWords = [];
  
  for (const word of wordList) {
    if (lowerText.includes(word)) {
      foundWords.push(word);
    }
  }
  
  return foundWords;
}

// @route   GET api/sentimen
// @desc    Mendapatkan semua ulasan
// @access  Public
router.get('/', async (req, res) => {
  try {
    logger.info('Fetching all sentiment reviews');
    const ulasan = await UlasanSentimen.find().sort({ ulasanId: -1 });
    res.json(ulasan);
  } catch (err) {
    logger.error(`Error fetching sentiment reviews: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/sentimen/stats
// @desc    Mendapatkan statistik sentimen
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    logger.info('Fetching sentiment statistics');
    
    // Menghitung jumlah total ulasan
    const totalUlasan = await UlasanSentimen.countDocuments();
    
    // Menghitung jumlah total produk dari koleksi ds_produk
    const totalProduk = await Produk.countDocuments();
    logger.info(`Total produk: ${totalProduk}`);
    
    // Menghitung distribusi sentimen
    const sentimentStats = await UlasanSentimen.aggregate([
      { 
        $group: { 
          _id: '$label', 
          count: { $sum: 1 } 
        } 
      }
    ]);
    
    // Mengubah format data untuk digunakan di front-end
    const sentimentDistribution = sentimentStats.map(stat => ({
      name: stat._id,
      value: (stat.count / totalUlasan) * 100,
      count: stat.count
    }));
    
    logger.info(`Fetched stats: ${sentimentStats.length} sentiment types, ${sentimentDistribution.length} distribution items`);
    res.json({
      totalUlasan,
      totalProduk,
      sentimentDistribution
    });
  } catch (err) {
    logger.error(`Error fetching sentiment statistics: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/sentimen/top-keywords
// @desc    Mendapatkan kata kunci populer dari ulasan
// @access  Public
router.get('/top-keywords', async (req, res) => {
  try {
    logger.info('Fetching top keywords from reviews');
    
    // Ambil ulasan positif dan negatif
    const positiveReviews = await UlasanSentimen.find(
      { label: 'positive' }, 
      { komentarUlasan: 1 }
    ).limit(1000);
    
    const negativeReviews = await UlasanSentimen.find(
      { label: 'negative' }, 
      { komentarUlasan: 1 }
    ).limit(1000);
    
    logger.info(`Found ${positiveReviews.length} positive reviews and ${negativeReviews.length} negative reviews`);
    
    // Hitung frekuensi kata positif
    const positiveKeywords = {};
    positiveReviews.forEach(review => {
      if (!review.komentarUlasan) return;
      
      const foundWords = findWords(review.komentarUlasan, positiveWords);
      foundWords.forEach(word => {
        positiveKeywords[word] = (positiveKeywords[word] || 0) + 1;
      });
    });
    
    // Hitung frekuensi kata negatif
    const negativeKeywords = {};
    negativeReviews.forEach(review => {
      if (!review.komentarUlasan) return;
      
      const foundWords = findWords(review.komentarUlasan, negativeWords);
      foundWords.forEach(word => {
        negativeKeywords[word] = (negativeKeywords[word] || 0) + 1;
      });
    });
    
    // Convert ke array dan sort berdasarkan frekuensi
    const positiveKeywordsArray = Object.entries(positiveKeywords)
      .map(([name, value]) => ({ name, value, sentiment: 'positive' }))
      .sort((a, b) => b.value - a.value);
      
    const negativeKeywordsArray = Object.entries(negativeKeywords)
      .map(([name, value]) => ({ name, value, sentiment: 'negative' }))
      .sort((a, b) => b.value - a.value);
    
    // Gabungkan kata kunci positif dan negatif
    let combinedKeywords = [...positiveKeywordsArray, ...negativeKeywordsArray];
    
    // Sort berdasarkan frekuensi dan ambil 7 teratas
    combinedKeywords = combinedKeywords
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
    
    const uniqueKeywordsCount = Object.keys(positiveKeywords).length + Object.keys(negativeKeywords).length;
    logger.info(`Extracted ${uniqueKeywordsCount} unique keywords (${Object.keys(positiveKeywords).length} positive, ${Object.keys(negativeKeywords).length} negative)`);
    
    // Jika tidak menemukan kata kunci, gunakan data placeholder
    if (combinedKeywords.length === 0) {
      logger.info('No keywords found, using placeholder data');
      combinedKeywords = [
        { name: 'bagus', value: 150, sentiment: 'positive' },
        { name: 'cepat', value: 120, sentiment: 'positive' },
        { name: 'sesuai', value: 100, sentiment: 'positive' },
        { name: 'kecewa', value: 80, sentiment: 'negative' },
        { name: 'lambat', value: 70, sentiment: 'negative' },
        { name: 'murah', value: 60, sentiment: 'positive' },
        { name: 'rusak', value: 50, sentiment: 'negative' }
      ];
    }
    
    res.json(combinedKeywords);
  } catch (err) {
    logger.error(`Error fetching top keywords: ${err.message}`);
    // Jika terjadi error, kembalikan data placeholder
    const placeholderKeywords = [
      { name: 'bagus', value: 150, sentiment: 'positive' },
      { name: 'cepat', value: 120, sentiment: 'positive' },
      { name: 'sesuai', value: 100, sentiment: 'positive' },
      { name: 'kecewa', value: 80, sentiment: 'negative' },
      { name: 'lambat', value: 70, sentiment: 'negative' },
      { name: 'murah', value: 60, sentiment: 'positive' },
      { name: 'rusak', value: 50, sentiment: 'negative' }
    ];
    res.json(placeholderKeywords);
  }
});

// @route   GET api/sentimen/recent
// @desc    Mendapatkan ulasan random
// @access  Public
router.get('/recent', async (req, res) => {
  try {
    logger.info('Fetching random reviews');
    
    // Menghitung total ulasan
    const totalUlasan = await UlasanSentimen.countDocuments();
    
    // Mengambil 3 ulasan secara random dengan informasi produkId
    const randomUlasan = await UlasanSentimen.aggregate([
      { $sample: { size: 3 } }
    ]);
    
    // Format ulasan untuk ditampilkan di dashboard
    const formattedUlasan = await Promise.all(randomUlasan.map(async (ulasan) => {
      // Coba temukan nama produk berdasarkan produkId
      let productName = 'Produk';
      try {
        if (ulasan.produkId) {
          const product = await Produk.findOne({ product_id: ulasan.produkId });
          if (product && product.nama_produk) {
            productName = product.nama_produk;
          }
        }
      } catch (err) {
        logger.error(`Error finding product name for ID ${ulasan.produkId}: ${err.message}`);
      }
      
      return {
        id: ulasan.ulasanId,
        produkId: ulasan.produkId,
        text: ulasan.komentarUlasan,
        customer: ulasan.pengguna,
        sentiment: ulasan.label,
        rating: ulasan.ratingUlasan,
        productName: productName
      };
    }));
    
    logger.info(`Fetched ${randomUlasan.length} random reviews from ${totalUlasan} total reviews`);
    res.json(formattedUlasan);
  } catch (err) {
    logger.error(`Error fetching random reviews: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/sentimen/produk-count
// @desc    Mendapatkan jumlah ulasan per produk dan total produk
// @access  Public
router.get('/produk-count', async (req, res) => {
  try {
    // Ambil jumlah produk unik dari ulasan
    const uniqueProducts = await UlasanSentimen.distinct('produkId');
    const count = uniqueProducts.length;
    
    logger.info(`Found ${count} unique products in reviews`);
    res.json({ count });
  } catch (err) {
    logger.error(`Error counting unique products: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

// @route   GET api/sentimen/analysis
// @desc    Mendapatkan analisis sentimen
// @access  Public
router.get('/analysis', async (req, res) => {
  try {
    logger.info('Generating sentiment analysis');
    
    // Menghitung distribusi sentimen
    const totalUlasan = await UlasanSentimen.countDocuments();
    const positiveCount = await UlasanSentimen.countDocuments({ label: 'positive' });
    const negativeCount = await UlasanSentimen.countDocuments({ label: 'negative' });
    const neutralCount = await UlasanSentimen.countDocuments({ label: 'neutral' });
    
    // Menghitung persentase
    const positivePercentage = ((positiveCount / totalUlasan) * 100).toFixed(1);
    const negativePercentage = ((negativeCount / totalUlasan) * 100).toFixed(1);
    
    // Ambil beberapa ulasan negatif untuk analisis
    const negativeReviews = await UlasanSentimen.find({ label: 'negative' })
      .sort({ createdAt: -1 })
      .limit(100);
    
    // Analisis masalah berdasarkan kelompok kata kunci
    const aspectIssues = {
      harga: 0,
      kualitas: 0,
      pengiriman: 0,
      pelayanan: 0,
      ukuran: 0,
      warna: 0,
      bahan: 0
    };
    
    // Analisis ulasan negatif
    negativeReviews.forEach(review => {
      if (!review.komentarUlasan) return;
      
      const text = review.komentarUlasan.toLowerCase();
      
      // Cek aspek yang dikeluhkan
      if (text.includes('harga') || text.includes('mahal')) {
        aspectIssues.harga++;
      }
      if (text.includes('kualitas') || text.includes('buruk') || text.includes('jelek')) {
        aspectIssues.kualitas++;
      }
      if (text.includes('kirim') || text.includes('lama') || text.includes('paket')) {
        aspectIssues.pengiriman++;
      }
      if (text.includes('layanan') || text.includes('respon') || text.includes('cs')) {
        aspectIssues.pelayanan++;
      }
      if (text.includes('ukuran') || text.includes('size') || text.includes('kecil') || text.includes('besar')) {
        aspectIssues.ukuran++;
      }
      if (text.includes('warna') || text.includes('color') || text.includes('pudar') || text.includes('beda')) {
        aspectIssues.warna++;
      }
      if (text.includes('bahan') || text.includes('kain') || text.includes('material') || text.includes('kusut')) {
        aspectIssues.bahan++;
      }
    });
    
    // Temukan aspek dengan masalah terbanyak
    const sortedAspects = Object.entries(aspectIssues)
      .sort((a, b) => b[1] - a[1])
      .filter(([_, count]) => count > 0)
      .slice(0, 3);
    
    // Buat rekomendasi
    let recommendation = 'Berdasarkan analisis sentimen, ';
    
    if (positivePercentage >= 70) {
      recommendation += `sebagian besar pelanggan puas dengan produk (${positivePercentage}%). `;
    } else if (positivePercentage >= 50) {
      recommendation += `cukup banyak pelanggan puas dengan produk (${positivePercentage}%), namun masih ada ruang untuk perbaikan. `;
    } else {
      recommendation += `tingkat kepuasan pelanggan perlu ditingkatkan karena hanya ${positivePercentage}% ulasan yang positif. `;
    }
    
    if (sortedAspects.length > 0) {
      recommendation += `Ulasan negatif (${negativePercentage}%) terutama terkait dengan `;
      
      sortedAspects.forEach(([aspect, _], index) => {
        if (index === 0) {
          recommendation += aspect;
        } else if (index === sortedAspects.length - 1) {
          recommendation += ` dan ${aspect}`;
        } else {
          recommendation += `, ${aspect}`;
        }
      });
      
      recommendation += '. ';
    }
    
    // Tambahkan rekomendasi spesifik
    recommendation += 'Rekomendasi: ';
    
    if (sortedAspects.length > 0) {
      const [topAspect, _] = sortedAspects[0];
      
      switch (topAspect) {
        case 'harga':
          recommendation += 'Evaluasi strategi harga atau berikan penawaran khusus untuk meningkatkan persepsi nilai.';
          break;
        case 'kualitas':
          recommendation += 'Tingkatkan standar kualitas produk dan lakukan quality control yang lebih ketat.';
          break;
        case 'pengiriman':
          recommendation += 'Perbaiki proses pengiriman dan komunikasi status pengiriman kepada pelanggan.';
          break;
        case 'pelayanan':
          recommendation += 'Tingkatkan pelatihan customer service dan waktu respons terhadap keluhan pelanggan.';
          break;
        case 'ukuran':
          recommendation += 'Berikan informasi ukuran yang lebih detail dan akurat pada deskripsi produk.';
          break;
        case 'warna':
          recommendation += 'Pastikan foto produk menampilkan warna yang akurat dan sesuai dengan produk aktual.';
          break;
        case 'bahan':
          recommendation += 'Tingkatkan kualitas bahan produk dan berikan informasi perawatan yang jelas.';
          break;
        default:
          recommendation += 'Tinjau ulasan negatif secara berkala dan lakukan perbaikan berkelanjutan.';
      }
    } else {
      recommendation += 'Pertahankan kualitas produk dan layanan saat ini, sambil terus memantau umpan balik pelanggan.';
    }
    
    logger.info('Generated sentiment analysis and recommendations');
    res.json({
      sentimentDistribution: {
        positive: parseFloat(positivePercentage),
        neutral: parseFloat(((neutralCount / totalUlasan) * 100).toFixed(1)),
        negative: parseFloat(negativePercentage)
      },
      topIssues: sortedAspects.map(([aspect, count]) => ({ 
        aspect, 
        count,
        percentage: parseFloat(((count / negativeReviews.length) * 100).toFixed(1))
      })),
      recommendation
    });
  } catch (err) {
    logger.error(`Error generating sentiment analysis: ${err.message}`);
    res.status(500).send('Server Error');
  }
});

module.exports = router;