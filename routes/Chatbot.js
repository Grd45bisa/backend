const express = require('express');
const router = express.Router();
const axios = require('axios');
const Produk = require('../models/produk');
const Ulasan = require('../models/ulasan');
require('dotenv').config();

// Environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SITE_URL = process.env.SITE_URL || 'http://localhost:5173/';
const SITE_NAME = process.env.SITE_NAME || 'FashionHub';

// System prompt - keeping this intact as it defines core functionality
const promptSystem = `
Kamu adalah asisten virtual dari toko fashion online bernama **FashionHub**. Tugasmu adalah memberikan pengalaman belanja yang menyenangkan, ramah, dan profesional kepada pelanggan. Fokus utama kamu adalah membantu pelanggan dalam hal fashion dan belanja online.

Berikut adalah panduan untuk interaksi kamu:
1. **Rekomendasi Produk FashionHub**:
  - PENTING: Hanya rekomendasikan produk yang ada di database, jangan pernah merekomendasikan produk yang tidak ada di database.
  - Berikan saran produk seperti T-shirt, celana, aksesoris, sepatu, atau tas yang sesuai dengan kebutuhan pelanggan.
  - Jelaskan keunggulan produk seperti bahan, kenyamanan, atau daya tahan.
  - Jika pelanggan meminta setelan, selalu berikan rekomendasi atasan (T-Shirt) dan bawahan (Pants) yang cocok sebagai satu set.
  - Untuk acara formal, rekomendasikan kemeja atau T-Shirt polos dengan warna netral dan celana panjang formal.
  - Untuk acara informal, rekomendasikan T-Shirt dengan desain casual dan celana santai.

2. **Panduan Ukuran dan Gaya**:
  - Bantu pelanggan memilih ukuran yang tepat dengan panduan ukuran yang jelas.
  - Tanyakan preferensi gaya seperti kasual, formal, minimalis, bohemian, edgy, atau vintage.
  - Diskusikan warna favorit atau warna yang ingin dihindari.

3. **Kebutuhan Khusus**:
  - Tanyakan apakah pelanggan mencari pakaian untuk acara tertentu, olahraga, ibu hamil, atau kebutuhan lainnya.
  - Berikan saran untuk menonjolkan atau menyamarkan bentuk tubuh sesuai keinginan pelanggan.

5. **Layanan Tambahan**:
  - **Virtual Styling**: Tawarkan layanan styling virtual untuk membantu pelanggan mencocokkan outfit.
  - **Outfit Builder**: Sarankan pelanggan mencoba fitur mix and match untuk menciptakan outfit impian.
  - **Artikel Fashion**: Berikan tips berpakaian, tren terbaru, atau cara merawat pakaian.

7. **Fashion Berkelanjutan**:
  - Informasikan tentang produk ramah lingkungan atau berkelanjutan untuk pelanggan yang peduli dengan isu lingkungan.

8. **Panduan Ukuran yang Detail**:
  - Sediakan panduan ukuran yang akurat, termasuk cara mengukur tubuh dengan benar.

Jika ada pertanyaan yang tidak relevan seperti permintaan membuat kode pemrograman, pertanyaan teknis, atau topik di luar fashion & e-commerce, tolak dengan sopan seperti:
> "Saat ini aku hanya bisa bantu seputar fashion & belanja ya. Kalau ada pertanyaan tentang produk, ukuran, atau promo, aku siap bantu banget! 💖"

**Catatan Penting**:
- diawal percakapan, sapa pelanggan dengan ramah sesuai waktu saat itu (pagi, siang, sore).
- Gunakan bahasa yang ramah, antusias, dan profesional.
- Tambahkan emoji sewajarnya untuk menciptakan kesan friendly. 😊
- PENTING: Selalu baca deskripsi produk sebelum menjawab pertanyaan pelanggan. Informasi detail produk terdapat dalam deskripsi, gunakan informasi ini untuk menjawab pertanyaan tentang bahan, fitur, atau detail lainnya.
- Jika ada pertanyaan yang tidak relevan, tolak dengan sopan.
- Kasih Nama Produk yang sesuai dengan di database.
- PENTING: Hanya rekomendasikan produk yang ada di database, jangan pernah merekomendasikan produk yang tidak ada di database.
- PENTING: Jika diminta setelan, selalu berikan rekomendasi atasan (T-Shirt) dan bawahan (Pants) yang cocok sebagai satu set.

INSTRUKSI KHUSUS UNTUK REKOMENDASI PRODUK:
Saat user meminta rekomendasi produk atau menanyakan produk tertentu, kamu harus memberikan respons dalam 2 bagian:

Bagian 1 - Berikan respons langsung dengan rekomendasi produk tanpa menulis "Bagian 1" atau "Rekomendasi Produk". Langsung saja tulis "Berikut produk yang saya rekomendasikan:" atau variasi lainnya, lalu tambahkan tag [PRODUCT_CARD] yang berisi produk-produk yang kamu rekomendasikan dalam format JSON seperti ini:

Berikut produk yang saya rekomendasikan untuk Anda:

[PRODUCT_CARD]
{
  "products": [
    {
      "id": "id produk dari database jika ada",
      "name": "nama produk persis seperti di database"
    },
    {
      "id": "id produk lain jika ada",
      "name": "nama produk lain"
    }
  ],
  "category": "kategori rekomendasi (misal: Casual T-Shirt, Formal Outfit)"
}
[/PRODUCT_CARD]

Bagian 2 - Berikan penjelasan detail tentang produk yang kamu rekomendasikan tanpa menulis "Bagian 2" atau "Detail Produk". Langsung berikan detail dan penjelasan. Jelaskan mengapa produk tersebut cocok untuk user, fitur-fitur unggulannya, dan bagaimana produk tersebut memenuhi kebutuhan user. Tambahkan juga tips penggunaan atau perawatan jika relevan. Gunakan format sebagai berikut:

[PRODUCT_DETAILS]
{
  "details": [
    {
      "name": "nama produk persis seperti di atas",
      "description": "deskripsi lengkap produk",
      "reason": "alasan kenapa produk ini direkomendasikan",
      "tips": "tips untuk menggunakan/merawat produk (opsional)"
    },
    {
      "name": "nama produk lain",
      "description": "deskripsi lengkap produk lain",
      "reason": "alasan kenapa produk ini direkomendasikan",
      "tips": "tips untuk menggunakan/merawat produk (opsional)"
    }
  ]
}
[/PRODUCT_DETAILS]

ATURAN KHUSUS JUMLAH PRODUK:
- SANGAT PENTING: Selalu rekomendasikan 1, 2, atau 4 produk. JANGAN PERNAH merekomendasikan 3 produk karena akan merusak tampilan UI.
- Jika kamu ingin merekomendasikan 3 produk, tambahkan 1 produk lagi atau kurangi 1 produk untuk mendapatkan jumlah yang ideal (2 atau 4).
- Untuk setelan outfit, rekomendasikan 2 produk (1 atasan + 1 bawahan) atau 4 produk (2 atasan + 2 bawahan atau 1 atasan + 1 bawahan + 2 aksesoris).

PENTING: 
1. Nama produk HARUS PERSIS sama dengan yang ada di database.
2. Jangan mengarang produk yang tidak ada di database.
3. Berikan 1, 2, atau 4 rekomendasi produk terbaik (JANGAN PERNAH merekomendasikan 3 produk).
4. Untuk outfit (setelan) rekomendasikan atasan (T-Shirt/Kemeja) dan bawahan (Celana/Pants) yang cocok sebagai satu set.
5. Jika tidak menemukan produk yang cocok dengan permintaan user, berikan alternatif terbaik yang tersedia di database.
6. Tag [PRODUCT_CARD] dan [PRODUCT_DETAILS] hanya digunakan saat merekomendasikan produk, tidak untuk percakapan biasa.
7. Jangan gunakan kata "Bagian 1", "Bagian 2", "Rekomendasi Produk", atau "Detail Produk" dalam respons, langsung berikan informasi yang dibutuhkan pelanggan.
8. Selalu baca deskripsi produk dengan teliti sebelum menjawab pertanyaan pelanggan.

INSTRUKSI KHUSUS UNTUK PERMINTAAN DARI CAROUSEL:
Jika permintaan berasal dari carousel (ditandai dengan parameter source='carousel'), berikan respons yang lengkap, informatif, dan relevan dengan topik carousel. Pastikan respons sesuai dengan konteks pertanyaan:

1. Untuk permintaan "Rekomendasi outfit untuk acara casual weekend", selalu sertakan minimal 2 produk yang terdiri dari atasan dan bawahan dari brand Erigo.
2. Untuk permintaan "Produk fashion terlaris minggu ini", berikan daftar 4 produk terlaris dengan data penjualan.
3. Untuk permintaan "Informasi metode pengiriman", berikan informasi lengkap tentang semua metode pengiriman yang tersedia beserta estimasi waktu dan biaya.
`;

// Improved time detection function to handle time zones correctly
function getSapaanByTime(userTime) {
  try {
    // Create Date object from input or current time
    const date = userTime ? new Date(userTime) : new Date();
    
    // Get local hour directly from the date object
    // This is the key improvement - using getHours() directly 
    // which respects the local timezone of the server
    const hour = date.getHours();
    
    // Standard Indonesian greeting based on time
    if (hour >= 3 && hour < 11) return 'Selamat pagi';
    if (hour >= 11 && hour < 15) return 'Selamat siang';
    if (hour >= 15 && hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  } catch (error) {
    console.error('Error in getSapaanByTime:', error);
    return 'Hai';
  }
}

// Helper function to normalize product count to 1, 2, or 4 (never 3)
function normalizeProductCount(products) {
  if (!products || products.length === 0) return [];
  if (products.length === 1 || products.length === 2 || products.length === 4) return products;
  if (products.length === 3) return products.slice(0, 2); // Return only 2 if there are 3
  if (products.length > 4) return products.slice(0, 4); // Limit to 4 if more
  return products;
}

// Convert chat history to Gemini format
function convertChatHistoryToGemini(history) {
  return history.map(message => ({
    role: message.role === 'system' ? 'user' : (message.role === 'user' ? 'user' : 'model'),
    parts: [{ text: message.role === 'system' ? `System: ${message.content}` : message.content }]
  }));
}

// Gemini API call function
async function generateGeminiContent(messages) {
  try {
    const data = {
      generationConfig: {
        temperature: 0.9,
        topP: 0.9,
        topK: 60,
        maxOutputTokens: 1000,
        responseMimeType: 'text/plain'
      },
      contents: messages,
    };
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await axios.post(url, data, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    
    const reply = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error('No response text in model output');
    
    return reply;
  } catch (error) {
    console.error('Gemini API error:', error.message);
    throw error;
  }
}

// Improved product info extraction with better error handling
function extractProductInfo(response) {
  let cleanResponse = response;
  let productCards = { products: [], category: '' };
  let productDetails = { details: [] };
  
  // Remove section markers from response
  cleanResponse = cleanResponse
    .replace(/Bagian [12][ -]*.*?:/gi, '')
    .replace(/Rekomendasi Produk[ -]*.*?:/gi, '')
    .replace(/Detail Produk[ -]*.*?:/gi, '');
  
  try {
    // Extract product card data
    const productCardMatch = response.match(/\[PRODUCT_CARD\]([\s\S]*?)(\[\/PRODUCT_CARD\]|$)/);
    if (productCardMatch && productCardMatch[1]) {
      try {
        productCards = JSON.parse(productCardMatch[1].trim());
      } catch (jsonError) {
        // Fallback: try to extract just the products array
        const productsMatch = productCardMatch[1].match(/"products"\s*:\s*\[([\s\S]*?)(\]|$)/);
        if (productsMatch) {
          try {
            const productsArray = JSON.parse('[' + productsMatch[1].trim() + ']');
            productCards = { products: productsArray, category: 'Rekomendasi Produk' };
          } catch (err) {
            console.error('Product array parsing error:', err.message);
          }
        }
      }
      
      // Remove product card section from response
      cleanResponse = cleanResponse.replace(/\[PRODUCT_CARD\][\s\S]*?(\[\/PRODUCT_CARD\]|$)/, '').trim();
    }
    
    // Extract product details
    const productDetailsMatch = response.match(/\[PRODUCT_DETAILS\]([\s\S]*?)(\[\/PRODUCT_DETAILS\]|$)/);
    if (productDetailsMatch && productDetailsMatch[1]) {
      try {
        productDetails = JSON.parse(productDetailsMatch[1].trim());
      } catch (jsonError) {
        // Fallback: try to extract just the details array
        const detailsMatch = productDetailsMatch[1].match(/"details"\s*:\s*\[([\s\S]*?)(\]|$)/);
        if (detailsMatch) {
          try {
            const detailsArray = JSON.parse('[' + detailsMatch[1].trim() + ']');
            productDetails = { details: detailsArray };
          } catch (err) {
            console.error('Details array parsing error:', err.message);
          }
        }
      }
      
      // Remove product details section from response
      cleanResponse = cleanResponse.replace(/\[PRODUCT_DETAILS\][\s\S]*?(\[\/PRODUCT_DETAILS\]|$)/, '').trim();
    }
    
    // If we have product cards but no details, create minimal details
    if (productCards.products?.length > 0 && (!productDetails.details || productDetails.details.length === 0)) {
      productDetails.details = productCards.products.map(product => ({
        name: product.name,
        description: product.description || '',
        reason: 'Produk yang sesuai dengan kebutuhan Anda'
      }));
    }
    
    // Clean up response
    cleanResponse = cleanResponse.trim().replace(/\n{3,}/g, '\n\n');
    
    return { cleanResponse, productCards, productDetails };
  } catch (error) {
    console.error('Error extracting product info:', error.message);
    return { 
      cleanResponse: response, 
      productCards: { products: [], category: '' },
      productDetails: { details: [] }
    };
  }
}

// Find products by name in database
async function findProductsByName(productNames) {
  if (!productNames || !productNames.length) return [];
  
  try {
    // Create regex queries for flexible matching
    const queries = productNames.map(name => ({
      nama_produk: { $regex: new RegExp(name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i') }
    }));
    
    // Find products with $or query
    const products = await Produk.find({ $or: queries });
    
    // Add ratings to products
    return await Promise.all(products.map(async (product) => {
      const productObj = product.toObject();
      
      if (!product.rating) {
        // Get average rating
        const ulasan = await Ulasan.find({ produk: product.nama_produk });
        productObj.rating = ulasan.length > 0 
          ? parseFloat((ulasan.reduce((sum, u) => sum + u.rating, 0) / ulasan.length).toFixed(1))
          : 5; // Default rating
      }
      
      return productObj;
    }));
  } catch (error) {
    console.error('Error finding products by name:', error.message);
    return [];
  }
}

// Initialize chat history
let chatHistory = [
  { role: 'system', content: promptSystem }
];

// Main chat route handler
router.post('/', async (req, res) => {
  const { input, timestamp, product, source } = req.body;
  
  // Input validation
  if (!input) return res.status(400).json({ error: 'Pertanyaan tidak boleh kosong' });
  if (input.length > 300) return res.status(400).json({ error: 'Pertanyaan tidak boleh lebih dari 300 karakter' });

  try {
    const sapaan = getSapaanByTime(timestamp);
    const isFirst = chatHistory.length === 1;
    
    // Get products for AI context
    let allProducts = [];
    try {
      allProducts = await Produk.find({ stok: { $gt: 0 } }).limit(3000);
    } catch (dbError) {
      console.error('Database error:', dbError.message);
    }
    
    // Find relevant products based on user input
    const inputLower = input.toLowerCase();
    const relevantProducts = allProducts.filter(p =>
      inputLower.includes(p.nama_produk?.toLowerCase()) ||
      inputLower.includes(p.kategori?.toLowerCase()) ||
      (p.deskripsi && p.deskripsi.toLowerCase().includes(inputLower))
    ).slice(0, 15);
    
    // Create database context for AI
    const dbProductsData = allProducts.map(p => ({
      id: p.product_id || p._id,
      name: p.nama_produk,
      category: p.kategori,
      price: p.harga,
      stock: p.stok,
      size: p.ukuran,
      description: p.deskripsi || 'Tidak ada deskripsi'
    }));
    
    // Initialize chat for new conversation
    if (isFirst) {
      chatHistory.push({ role: 'user', content: `${sapaan}, saya ingin bertanya.` });
      chatHistory.push({ role: 'assistant', content: 'Tentu, saya siap membantu 😊 Ada yang bisa saya bantu terkait fashion atau produk FashionHub?' });
      chatHistory.push({ role: 'system', content: `DATABASE_PRODUK (${dbProductsData.length} produk):\n${JSON.stringify(dbProductsData, null, 2)}` });
    }

    // Handle product query
    if (product) {
      chatHistory.push({ role: 'user', content: `[Produk: ${product.name}] ${input}` });
      
      const productData = allProducts.find(p => 
        p.nama_produk === product.name || 
        p.product_id === product.id
      );
      
      if (productData) {
        chatHistory.push({ role: 'system', content: `Informasi detail produk yang ditanyakan:\n${JSON.stringify({
          id: productData.product_id || productData._id,
          name: productData.nama_produk,
          category: productData.kategori,
          price: productData.harga,
          stock: productData.stok,
          size: productData.ukuran,
          description: productData.deskripsi || 'Tidak ada deskripsi'
        }, null, 2)}` });
      }
    } else {
      // Regular user input
      chatHistory.push({ role: 'user', content: input });
      
      // Add carousel source info if applicable
      if (source === 'carousel') {
        chatHistory.push({ role: 'system', content: `Pertanyaan ini berasal dari carousel. Berikan jawaban resmi, lengkap, dan ramah seperti respons yang sudah disiapkan.` });
        
        // Add specific carousel query instructions
        if (inputLower.includes('outfit') && inputLower.includes('casual')) {
          chatHistory.push({ role: 'system', content: `Berikan rekomendasi outfit casual dengan fokus pada produk T-shirt dan celana, dan beri contoh outfit yang cocok dari database. Sebutkan merek Erigo dalam rekomendasi.` });
        } 
        else if (inputLower.includes('produk') && inputLower.includes('terlaris')) {
          chatHistory.push({ role: 'system', content: `Berikan informasi tentang produk terlaris FashionHub, utamakan T-shirt dan Pants dari Erigo yang ada di database. Jangan rekomendasikan produk yang tidak ada di database.` });
        }
        else if (inputLower.includes('pengiriman')) {
          chatHistory.push({ role: 'system', content: `Berikan informasi tentang metode pengiriman di FashionHub, termasuk jenis pengiriman, estimasi waktu, dan biaya. Format informasi dengan rapi dan mudah dibaca.` });
        }
      }
      
      // Add relevant product context
      if (relevantProducts.length > 0) {
        const relevantProductsData = relevantProducts.map(p => ({
          id: p.product_id || p._id,
          name: p.nama_produk,
          category: p.kategori,
          price: p.harga,
          stock: p.stok,
          size: p.ukuran,
          description: p.deskripsi || 'Tidak ada deskripsi'
        }));
        
        chatHistory.push({ role: 'system', content: `Produk yang relevan dengan pertanyaan user:\n${JSON.stringify(relevantProductsData, null, 2)}` });
      }
    }
    
    // Refresh database context periodically
    if (chatHistory.length % 5 === 0) {
      chatHistory.push({ role: 'system', content: `DATABASE_PRODUK (refresh, ${dbProductsData.length} produk):\n${JSON.stringify(dbProductsData, null, 2)}` });
    }
    
    // Convert chat history to Gemini format
    const geminiMessages = convertChatHistoryToGemini(chatHistory);
    
    // Generate response from Gemini with fallback
    let aiResponse;
    try {
      aiResponse = await generateGeminiContent(geminiMessages);
    } catch (modelError) {
      console.error('Model error:', modelError.message);
      
      // Fallback responses for carousel queries
      if (source === 'carousel') {
        if (inputLower.includes('outfit') && inputLower.includes('casual')) {
          aiResponse = `Untuk acara casual weekend, saya merekomendasikan kombinasi berikut:

[PRODUCT_CARD]
{
  "products": [
    {
      "id": "TS001",
      "name": "Erigo T-Shirt Skye Black"
    },
    {
      "id": "DP001",
      "name": "Erigo Denim Pants Edwin Medium Blue"
    }
  ],
  "category": "Casual Outfit"
}
[/PRODUCT_CARD]

[PRODUCT_DETAILS]
{
  "details": [
    {
      "name": "Erigo T-Shirt Skye Black",
      "description": "T-shirt hitam dengan desain modern dan nyaman dipakai. Terbuat dari bahan katun premium yang lembut di kulit.",
      "reason": "Cocok untuk gaya casual weekend dengan desain yang versatile sehingga mudah dipadukan",
      "tips": "Padukan dengan celana jeans atau chino untuk tampilan casual yang stylish"
    },
    {
      "name": "Erigo Denim Pants Edwin Medium Blue",
      "description": "Celana denim dengan warna medium blue yang trendy. Potongan slim fit memberikan tampilan rapi namun tetap nyaman.",
      "reason": "Menyempurnakan outfit casual weekend Anda dengan warna yang mudah dipadukan",
      "tips": "Cocok dipakai untuk berbagai aktivitas weekend dari jalan-jalan sampai hangout dengan teman"
    }
  ]
}
[/PRODUCT_DETAILS]`;
        } 
        else if (inputLower.includes('produk') && inputLower.includes('terlaris')) {
          aiResponse = `Berikut adalah produk-produk terlaris minggu ini di FashionHub:

[PRODUCT_CARD]
{
  "products": [
    {
      "id": "TS001",
      "name": "Erigo T-Shirt Skye Black"
    },
    {
      "id": "TS002",
      "name": "Erigo T-Shirt Selkie Olive"
    },
    {
      "id": "DP001",
      "name": "Erigo Denim Pants Edwin Medium Blue"
    },
    {
      "id": "JK001",
      "name": "Erigo Jacket Harrington Black"
    }
  ],
  "category": "Produk Terlaris"
}
[/PRODUCT_CARD]

[PRODUCT_DETAILS]
{
  "details": [
    {
      "name": "Erigo T-Shirt Skye Black",
      "description": "T-shirt hitam dengan desain modern dan nyaman dipakai. Terbuat dari bahan katun premium.",
      "reason": "Terjual 120+ pcs minggu ini karena desainnya yang versatile dan kualitas bahan premium"
    },
    {
      "name": "Erigo T-Shirt Selkie Olive",
      "description": "T-shirt warna olive yang stylish dan nyaman. Cocok untuk berbagai aktivitas casual.",
      "reason": "Terjual 95+ pcs minggu ini berkat warna trendy dan kenyamanan saat dipakai"
    },
    {
      "name": "Erigo Denim Pants Edwin Medium Blue",
      "description": "Celana denim dengan warna medium blue. Potongan slim fit yang nyaman dan trendy.",
      "reason": "Terjual 85+ pcs karena kualitas denim yang tahan lama dan potongan yang flattering"
    },
    {
      "name": "Erigo Jacket Harrington Black",
      "description": "Jaket Harrington hitam yang stylish dengan detail desain modern.",
      "reason": "Terjual 65+ pcs berkat desain timeless yang bisa dipadukan dengan berbagai outfit"
    }
  ]
}
[/PRODUCT_DETAILS]`;
        }
        else if (inputLower.includes('pengiriman')) {
          aiResponse = `FashionHub menyediakan beberapa metode pengiriman sebagai berikut:

1. Regular (2-3 hari kerja)
   - JNE Regular: Rp15.000 - Rp25.000
   - SiCepat REG: Rp15.000 - Rp25.000

2. Express (1-2 hari kerja)
   - JNE YES: Rp20.000 - Rp35.000
   - SiCepat BEST: Rp20.000 - Rp35.000
   - AnterAja Express: Rp20.000 - Rp35.000

3. Same Day (pengiriman di hari yang sama)
   - Gosend Instant: Rp25.000 - Rp45.000 (khusus area tertentu)

Tarif pengiriman bergantung pada berat paket dan jarak pengiriman. Estimasi biaya pengiriman akan muncul saat checkout.`;
        } else {
          aiResponse = "Mohon maaf, saya sedang mengalami gangguan teknis. Silakan coba lagi dalam beberapa saat atau hubungi tim dukungan kami. 😊";
        }
      } else {
        aiResponse = "Mohon maaf, saya sedang mengalami gangguan teknis. Silakan coba lagi dalam beberapa saat atau hubungi tim dukungan kami. 😊";
      }
      
      // Add fallback response to chat history
      chatHistory.push({ role: 'assistant', content: aiResponse });
      
      // Return fallback response to client
      return res.json({ 
        response: aiResponse,
        products: [], 
        category: 'Rekomendasi Produk',
        detailsMessage: '' 
      });
    }
    
    // Extract product information and clean response
    const { cleanResponse, productCards, productDetails } = extractProductInfo(aiResponse);
    
    // Find real products based on names in product cards
    let realProductsData = [];
    if (productCards.products && productCards.products.length > 0) {
      const productNames = productCards.products.map(p => p.name);
      realProductsData = await findProductsByName(productNames);
      realProductsData = normalizeProductCount(realProductsData);
      
      // Add details to real products
      realProductsData = realProductsData.map(realProduct => {
        const matchingDetail = productDetails.details?.find(detail => 
          detail.name.toLowerCase() === realProduct.nama_produk.toLowerCase()
        );
        
        if (matchingDetail) {
          realProduct.description = matchingDetail.description || realProduct.deskripsi;
          realProduct.reason = matchingDetail.reason;
          realProduct.tips = matchingDetail.tips;
        }
        
        return realProduct;
      });
    }
    
    // Handle carousel queries with no products found
    if (source === 'carousel' && (inputLower.includes('outfit') || inputLower.includes('produk') || inputLower.includes('terlaris')) && realProductsData.length === 0) {
      try {
        if (inputLower.includes('outfit')) {
          const defaultTShirts = await Produk.find({ 
            kategori: { $regex: /T-Shirt|Kaos/i },
            stok: { $gt: 0 }
          }).limit(2);
          
          const defaultPants = await Produk.find({ 
            kategori: { $regex: /Celana|Pants/i },
            stok: { $gt: 0 }
          }).limit(2);
          
          realProductsData = [...defaultTShirts, ...defaultPants].slice(0, 4);
        } 
        else if (inputLower.includes('terlaris') || inputLower.includes('produk')) {
          realProductsData = await Produk.find({ stok: { $gt: 0 } })
            .sort({ terjual: -1 })
            .limit(4);
        }
        
        realProductsData = normalizeProductCount(realProductsData);
      } catch (error) {
        console.error('Error finding default products:', error.message);
      }
    }
    
    // Find similar products if none found
    if (productCards.products && productCards.products.length > 0 && realProductsData.length === 0) {
      const categories = new Set(productCards.products.map(p => 
        p.category || (p.name.toLowerCase().includes('kaos') || p.name.toLowerCase().includes('t-shirt') ? 'T-Shirt' : 
        p.name.toLowerCase().includes('celana') || p.name.toLowerCase().includes('pants') ? 'Pants' : null)
      ).filter(Boolean));
      
      if (categories.size > 0) {
        try {
          const categoryProducts = await Produk.find({
            kategori: { $in: Array.from(categories).map(c => new RegExp(c, 'i')) },
            stok: { $gt: 0 }
          }).limit(4);
          
          realProductsData = categoryProducts.map(product => {
            const productObj = product.toObject();
            productObj.reason = "Produk alternatif yang tersedia di kategori ini";
            return productObj;
          });
          
          realProductsData = normalizeProductCount(realProductsData);
        } catch (error) {
          console.error('Error finding category products:', error.message);
        }
      }
    }
    
    // Add clean response to chat history
    chatHistory.push({ role: 'assistant', content: cleanResponse });
    
    // Limit chat history length
    if (chatHistory.length > 20) {
      const systemMessage = chatHistory[0];
      chatHistory = [systemMessage, ...chatHistory.slice(-19)];
    }
    
    // Prepare product details message
    let detailsMessage = '';
    if (realProductsData.length > 0 && productDetails.details?.length > 0) {
      const detailsList = productDetails.details
        .filter(detail => realProductsData.some(p => p.nama_produk === detail.name))
        .map(detail => {
          return `**${detail.name}**\n\n${detail.description || ''}\n\n**Alasan rekomendasi**: ${detail.reason || ''}\n${detail.tips ? `\n**Tips**: ${detail.tips}` : ''}`;
        }).join('\n\n---\n\n');
      
      detailsMessage = detailsList;
    }
    
    // Auto-generate details for carousel queries
    if (source === 'carousel' && realProductsData.length > 0 && (!productDetails.details || productDetails.details.length === 0)) {
      const autoDetails = realProductsData.map(product => {
        let description = product.deskripsi || '';
        let reason = '';
        
        if (inputLower.includes('outfit')) {
          reason = product.kategori?.toLowerCase().includes('t-shirt') 
            ? 'T-shirt ini sangat cocok untuk gaya casual weekend dengan desain yang stylish dan nyaman dipakai.'
            : product.kategori?.toLowerCase().includes('celana')
              ? 'Celana ini memberikan kenyamanan maksimal untuk aktivitas casual weekend dengan potongan yang pas.'
              : 'Produk ini sangat cocok untuk melengkapi outfit casual weekend Anda.';
        } else if (inputLower.includes('terlaris')) {
          reason = 'Produk ini menjadi favorit customer FashionHub dengan kualitas dan desain yang trendy.';
        } else {
          reason = 'Produk pilihan dengan kualitas terbaik dari FashionHub.';
        }
        
        return `**${product.nama_produk}**\n\n${description}\n\n**Alasan rekomendasi**: ${reason}`;
      }).join('\n\n---\n\n');
      
      detailsMessage = autoDetails;
    }
    
    // Prepare final response
    const finalResponse = {
      response: cleanResponse,
      products: realProductsData,
      category: productCards.category || 'Rekomendasi Produk',
      detailsMessage: detailsMessage
    };
    
    // Send response to client
    return res.json(finalResponse);
  } catch (error) {
    console.error('Error in chatbot route:', error.message);
    return res.status(500).json({ 
      error: 'Server error',
      response: 'Mohon maaf, terjadi kesalahan saat memproses permintaan Anda. Silakan coba lagi dalam beberapa saat.',
      products: [],
      detailsMessage: ''
    });
  }
});

module.exports = router;