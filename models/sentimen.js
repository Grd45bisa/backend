const mongoose = require('mongoose');

// Skema untuk aspek sentimen
const aspekSchema = new mongoose.Schema({
  harga: {
    skor: { type: Number, default: 0 },
    label: { type: String, enum: ['positif', 'negatif', 'netral'], default: 'netral' }
  },
  kualitas: {
    skor: { type: Number, default: 0 },
    label: { type: String, enum: ['positif', 'negatif', 'netral'], default: 'netral' }
  },
  pengiriman: {
    skor: { type: Number, default: 0 },
    label: { type: String, enum: ['positif', 'negatif', 'netral'], default: 'netral' }
  },
  pelayanan: {
    skor: { type: Number, default: 0 },
    label: { type: String, enum: ['positif', 'negatif', 'netral'], default: 'netral' }
  }
}, { _id: false });

// Skema utama untuk sentimen
const sentimenSchema = new mongoose.Schema({
  ulasanId: {
    type: mongoose.Schema.Types.Mixed, // Mendukung ID numerik dan string
    required: true,
    index: true
  },
  produkId: {
    type: mongoose.Schema.Types.Mixed, // Mendukung ID numerik dan string
    required: true,
    index: true
  },
  komentarUlasan: {
    type: String,
    required: true
  },
  ratingUlasan: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  pengguna: {
    type: String,
    required: true
  },
  skor: {
    type: Number,
    required: true
  },
  label: {
    type: String,
    required: true,
    enum: ['positive', 'negative', 'neutral']
  },
  aspek: {
    type: aspekSchema,
    default: () => ({})
  },
  alasan: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index untuk pencarian yang efisien
sentimenSchema.index({ produkId: 1 });
sentimenSchema.index({ label: 1 });
sentimenSchema.index({ 'aspek.kualitas.label': 1 });
sentimenSchema.index({ 'aspek.harga.label': 1 });
sentimenSchema.index({ 'aspek.pengiriman.label': 1 });
sentimenSchema.index({ 'aspek.pelayanan.label': 1 });

// Update timestamp ketika dokumen diperbarui
sentimenSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Metode untuk membuat sentimen dari ulasan
sentimenSchema.statics.createFromReview = async function(review) {
  const rating = review.rating;
  
  // Tentukan label sentimen berdasarkan rating
  let label = 'neutral';
  if (rating >= 4) label = 'positive';
  else if (rating <= 2) label = 'negative';
  
  // Hitung skor sederhana berkisar 0-1
  const skor = (rating - 1) / 4; // Transformasi 1-5 menjadi 0-1
  
  // Ektraksi aspek-aspek sentimen
  const aspek = {
    kualitas: { skor: 0, label: 'netral' },
    harga: { skor: 0, label: 'netral' },
    pengiriman: { skor: 0, label: 'netral' },
    pelayanan: { skor: 0, label: 'netral' }
  };
  
  const komentarLower = review.komentar.toLowerCase();
  
  // Analisis aspek kualitas
  if (/bagus|keren|nyaman|awet|tahan|mantap|berkualitas|premium|halus|lembut|enak/i.test(komentarLower)) {
    aspek.kualitas.skor = 0.8;
    aspek.kualitas.label = 'positif';
  } else if (/jelek|buruk|rusak|cacat|sobek|luntur|tipis|pudar|kusut|kasar|tidak nyaman/i.test(komentarLower)) {
    aspek.kualitas.skor = 0.2;
    aspek.kualitas.label = 'negatif';
  }
  
  // Analisis aspek harga
  if (/murah|terjangkau|worth|sepadan|ekonomis|hemat|value|diskon|promo/i.test(komentarLower)) {
    aspek.harga.skor = 0.8;
    aspek.harga.label = 'positif';
  } else if (/mahal|kemahalan|tidak worth|tidak sepadan|overprice|overpriced|tidak sebanding/i.test(komentarLower)) {
    aspek.harga.skor = 0.2;
    aspek.harga.label = 'negatif';
  }
  
  // Analisis aspek pengiriman
  if (/cepat|tepat waktu|sesuai jadwal|aman|rapi|utuh|tidak rusak|pengiriman/i.test(komentarLower)) {
    aspek.pengiriman.skor = 0.8;
    aspek.pengiriman.label = 'positif';
  } else if (/lambat|telat|terlambat|lama|rusak|bocor|penyok|tidak sesuai|salah alamat/i.test(komentarLower)) {
    aspek.pengiriman.skor = 0.2;
    aspek.pengiriman.label = 'negatif';
  }
  
  // Analisis aspek pelayanan
  if (/ramah|responsif|cepat|membantu|informatif|profesional|baik|memuaskan|service/i.test(komentarLower)) {
    aspek.pelayanan.skor = 0.8;
    aspek.pelayanan.label = 'positif';
  } else if (/jutek|lambat|tidak responsif|mengabaikan|kasar|tidak profesional|tidak membantu|mengecewakan/i.test(komentarLower)) {
    aspek.pelayanan.skor = 0.2;
    aspek.pelayanan.label = 'negatif';
  }
  
  // Buat alasan analisis
  let alasan = `Analisis sentimen berdasarkan rating ${rating}/5 dan konten ulasan. `;
  
  // Tambahkan alasan berdasarkan aspek yang teridentifikasi
  const aspekPositif = [];
  const aspekNegatif = [];
  
  if (aspek.kualitas.label === 'positif') aspekPositif.push('kualitas produk');
  else if (aspek.kualitas.label === 'negatif') aspekNegatif.push('kualitas produk');
  
  if (aspek.harga.label === 'positif') aspekPositif.push('harga');
  else if (aspek.harga.label === 'negatif') aspekNegatif.push('harga');
  
  if (aspek.pengiriman.label === 'positif') aspekPositif.push('pengiriman');
  else if (aspek.pengiriman.label === 'negatif') aspekNegatif.push('pengiriman');
  
  if (aspek.pelayanan.label === 'positif') aspekPositif.push('pelayanan');
  else if (aspek.pelayanan.label === 'negatif') aspekNegatif.push('pelayanan');
  
  if (aspekPositif.length > 0) {
    alasan += `Pelanggan mengapresiasi ${aspekPositif.join(', ')}. `;
  }
  
  if (aspekNegatif.length > 0) {
    alasan += `Pelanggan mengkritisi ${aspekNegatif.join(', ')}. `;
  }
  
  // Buat objek sentimen
  return this.create({
    ulasanId: review._id,
    produkId: review.produk_id || review.produk,
    komentarUlasan: review.komentar,
    ratingUlasan: review.rating,
    pengguna: review.pengguna,
    skor: skor,
    label: label,
    aspek: aspek,
    alasan: alasan
  });
};

// Ekspor model
module.exports = mongoose.models.Sentimen || mongoose.model('Sentimen', sentimenSchema, 'ds_sentimen');