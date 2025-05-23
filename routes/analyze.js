// routes/analyze.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const UlasanSentimen = require('../models/sentimen');
const Produk = require('../models/produk');
require('dotenv').config();

// Get API key from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
* Route utama untuk analisis dashboard
*/
router.post('/', async (req, res) => {
 try {
   const { sentimentStats, keywordsData } = req.body;
   
   // Siapkan data sentimen dan kata kunci
   let sentimentData = sentimentStats;
   let keywords = keywordsData;
   
   // Jika data tidak diberikan, ambil dari database
   if (!sentimentData || !keywords) {
     const totalUlasan = await UlasanSentimen.countDocuments();
     const positiveCount = await UlasanSentimen.countDocuments({ label: 'positive' });
     const negativeCount = await UlasanSentimen.countDocuments({ label: 'negative' });
     const neutralCount = await UlasanSentimen.countDocuments({ label: 'neutral' });
     
     // Hitung persentase
     sentimentData = {
       positive: parseFloat(((positiveCount / totalUlasan) * 100).toFixed(1)),
       neutral: parseFloat(((neutralCount / totalUlasan) * 100).toFixed(1)),
       negative: parseFloat(((negativeCount / totalUlasan) * 100).toFixed(1)),
       totalReviews: totalUlasan
     };
     
     // Data kata kunci placeholder
     keywords = [
       { name: 'bagus', value: 150, sentiment: 'positive' },
       { name: 'cepat', value: 120, sentiment: 'positive' },
       { name: 'sesuai', value: 100, sentiment: 'positive' },
       { name: 'kecewa', value: 80, sentiment: 'negative' },
       { name: 'lambat', value: 70, sentiment: 'negative' }
     ];
   }
   
   // Prompt untuk analisis
   const prompt = `
   Analisis data sentimen berikut dari toko fashion online:
   
   Data Sentimen:
   - Sentimen Positif: ${sentimentData.positive}%
   - Sentimen Netral: ${sentimentData.neutral}%
   - Sentimen Negatif: ${sentimentData.negative}%
   - Total Ulasan: ${sentimentData.totalReviews}
   
   Kata Kunci Populer:
   ${keywords.map(k => `- ${k.name} (${k.sentiment}): ${k.value} kali`).join('\n')}
   
   Berikan respons dalam format JSON dengan struktur:
   {
     "summary": "Ringkasan singkat analisis sentimen (1-2 kalimat)",
     "trends": "Tren utama berdasarkan kata kunci (1-2 kalimat)",
     "insights": ["Wawasan 1", "Wawasan 2", "Wawasan 3"],
     "improvements": "Area yang perlu perbaikan (1-2 kalimat)",
     "recommendations": ["Rekomendasi 1", "Rekomendasi 2", "Rekomendasi 3", "Rekomendasi 4"]
   }
   `;
   
   // Konfigurasi untuk request
   const messages = [{ role: 'user', parts: [{ text: prompt }] }];
   const data = {
     generationConfig: {
       temperature: 0.4,
       maxOutputTokens: 1024
     },
     contents: messages,
   };
   
   // Kirim request ke API
   const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
   const response = await axios.post(url, data, {
     headers: { 'Content-Type': 'application/json' },
     timeout: 30000
   });
   
   // Parse respons JSON
   const reply = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
   let analysis;
   
   try {
     const jsonMatch = reply.match(/({[\s\S]*})/);
     analysis = JSON.parse(jsonMatch ? jsonMatch[0] : reply);
   } catch (jsonError) {
     console.error('Error parsing JSON:', jsonError);
     
     // Fallback analysis
     analysis = {
       summary: `Analisis dari ${sentimentData.totalReviews} ulasan menunjukkan sentimen positif sebesar ${sentimentData.positive}%, dengan ${sentimentData.neutral}% netral dan ${sentimentData.negative}% negatif, yang mengindikasikan tingkat kepuasan pelanggan yang baik.`,
       trends: "Kata kunci 'bagus', 'cepat', dan 'sesuai' mendominasi ulasan positif, sementara 'kecewa' dan 'lambat' menonjol dalam ulasan negatif, menunjukkan kualitas produk dan kecepatan pengiriman menjadi faktor penting.",
       insights: [
         "Kepuasan pelanggan tertinggi terkait dengan kualitas produk dan kecepatan pengiriman.",
         "Sebagian besar keluhan pelanggan berfokus pada keterlambatan pengiriman dan beberapa masalah kualitas.",
         "Kategori T-Shirt menerima sentimen positif tertinggi dibandingkan kategori lain."
       ],
       improvements: "Area yang perlu peningkatan terutama pada konsistensi waktu pengiriman dan komunikasi status pesanan yang lebih baik kepada pelanggan.",
       recommendations: [
         "Optimalkan proses pengiriman untuk mengurangi keluhan keterlambatan.",
         "Tingkatkan QC pada produk yang mendapat ulasan negatif tentang kualitas.",
         "Gunakan kata kunci positif (bagus, cepat, sesuai) dalam materi pemasaran.",
         "Kembangkan program loyalitas untuk pelanggan yang secara konsisten memberikan ulasan positif."
       ]
     };
   }
   
   // Tambahkan timestamp
   analysis.generatedAt = new Date().toISOString();
   
   // Kembalikan analisis ke client
   return res.json({ success: true, analysis });
   
 } catch (error) {
   console.error('Error:', error);
   
   // Kirim analisis fallback jika gagal
   return res.status(500).json({
     success: false,
     error: error.message,
     analysis: {
       summary: "Analisis dari 1.248 ulasan menunjukkan sentimen positif sebesar 73.5%, dengan 15.8% netral dan 10.7% negatif, yang mengindikasikan tingkat kepuasan pelanggan yang baik.",
       trends: "Kata kunci 'bagus', 'cepat', dan 'sesuai' mendominasi ulasan positif, sementara 'kecewa' dan 'lambat' menonjol dalam ulasan negatif, menunjukkan kualitas produk dan kecepatan pengiriman menjadi faktor penting.",
       insights: [
         "Kepuasan pelanggan tertinggi terkait dengan kualitas produk dan kecepatan pengiriman.",
         "Sebagian besar keluhan pelanggan berfokus pada keterlambatan pengiriman dan beberapa masalah kualitas.",
         "Kategori T-Shirt menerima sentimen positif tertinggi dibandingkan kategori lain."
       ],
       improvements: "Area yang perlu peningkatan terutama pada konsistensi waktu pengiriman dan komunikasi status pesanan yang lebih baik kepada pelanggan.",
       recommendations: [
         "Optimalkan proses pengiriman untuk mengurangi keluhan keterlambatan.",
         "Tingkatkan QC pada produk yang mendapat ulasan negatif tentang kualitas.",
         "Gunakan kata kunci positif (bagus, cepat, sesuai) dalam materi pemasaran.",
         "Kembangkan program loyalitas untuk pelanggan yang secara konsisten memberikan ulasan positif."
       ],
       generatedAt: new Date().toISOString(),
       fallback: true
     }
   });
 }
});

/**
* Route untuk analisis kata kunci
*/
router.post('/keywords', async (req, res) => {
 try {
   const { keywords } = req.body;
   
   if (!keywords || !keywords.length) {
     return res.status(400).json({ error: 'Kata kunci diperlukan' });
   }
   
   // Prompt untuk analisis kata kunci
   const prompt = `
   Analisis kata kunci berikut dari ulasan produk fashion:
   ${keywords.map(k => `- ${k.name} (${k.sentiment}): ${k.value} kali`).join('\n')}
   
   Berikan wawasan tentang apa yang pelanggan sukai atau tidak sukai berdasarkan kata kunci ini.
   Respons dalam format JSON dengan struktur:
   {
     "keywordInsights": ["Wawasan 1", "Wawasan 2", "Wawasan 3"],
     "recommendations": ["Rekomendasi 1", "Rekomendasi 2"]
   }
   `;
   
   // Kirim request dan dapatkan respons
   const messages = [{ role: 'user', parts: [{ text: prompt }] }];
   const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
   
   const response = await axios.post(url, {
     generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
     contents: messages,
   }, {
     headers: { 'Content-Type': 'application/json' },
     timeout: 15000,
   });
   
   // Parse respons
   const reply = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
   let insights;
   
   try {
     const jsonMatch = reply.match(/({[\s\S]*})/);
     insights = JSON.parse(jsonMatch ? jsonMatch[0] : reply);
   } catch (jsonError) {
     console.error('Error parsing JSON keyword insights:', jsonError);
     
     // Fallback insights
     insights = {
       keywordInsights: [
         "Kata kunci positif seperti 'bagus' dan 'cepat' menunjukkan kepuasan terhadap kualitas produk dan pengiriman.",
         "Pelanggan secara konsisten memuji kesesuaian produk dengan deskripsi yang diberikan.",
         "Keluhan utama terkait dengan masalah keterlambatan dan kekecewaan terhadap beberapa aspek produk."
       ],
       recommendations: [
         "Pertahankan dan tingkatkan aspek kualitas dan pengiriman yang sering dipuji.",
         "Atasi masalah keterlambatan dengan meningkatkan proses logistik."
       ]
     };
   }
   
   return res.json({
     success: true,
     insights
   });
   
 } catch (error) {
   console.error('Error analyzing keywords:', error);
   return res.status(500).json({
     success: false,
     error: error.message,
     insights: {
       keywordInsights: [
         "Kata kunci positif menunjukkan kepuasan terhadap kualitas produk.",
         "Pelanggan mengapresiasi kecepatan pengiriman dan layanan.",
         "Kata kunci negatif menunjukkan area yang perlu perhatian."
       ],
       recommendations: [
         "Tingkatkan aspek yang sering mendapat ulasan positif.",
         "Atasi masalah yang teridentifikasi dari kata kunci negatif."
       ]
     }
   });
 }
});

module.exports = router;