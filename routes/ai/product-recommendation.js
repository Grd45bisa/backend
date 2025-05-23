// routes/ai/product-recommendation.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const Produk = require('../../models/produk');
require('dotenv').config();

// Get API key from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * API endpoint for AI-powered product recommendations
 * Uses the same AI approach as the chatbot for consistency
 */
router.post('/', async (req, res) => {
  try {
    const { query, limit = 3 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Step 1: Get top products from database (to have a fallback)
    const topProducts = await Produk.find({ stok: { $gt: 0 } })
      .sort({ terjual: -1 })
      .limit(limit);
    
    // Create a simplified product catalog for the AI to process
    const allProducts = await Produk.find({ stok: { $gt: 0 } }).limit(50);
    const productCatalog = allProducts.map(product => ({
      id: product.product_id,
      name: product.nama_produk,
      category: product.kategori,
      price: product.harga,
      size: product.ukuran,
      condition: product.kondisi,
      // Only include first 100 chars of description to save tokens
      description: product.deskripsi?.substring(0, 100) || ''
    }));

    // Step 2: Create prompt for Gemini AI
    const prompt = `
    Kamu adalah AI assistant untuk toko fashion online FashionHub.
    
    Berdasarkan query berikut: "${query}"
    
    Pilih ${limit} produk yang paling relevan dari katalog berikut:
    ${JSON.stringify(productCatalog)}
    
    Berikan respons dalam format JSON dengan struktur PERSIS seperti ini:
    {
      "productIds": [id1, id2, id3],
      "productNames": ["nama produk 1", "nama produk 2", "nama produk 3"],
      "reasoning": "Penjelasan singkat mengapa produk ini dipilih"
    }
    
    PENTING:
    1. Pastikan produk yang dipilih adalah PERSIS nama yang ada di database
    2. Selalu berikan TEPAT ${limit} produk, tidak lebih tidak kurang
    3. Hanya berikan JSON saja, tanpa text tambahan
    4. Untuk query tentang outfit, pastikan kamu memilih kombinasi atasan dan bawahan yang matching
    5. Untuk query produk terlaris, pilih produk-produk dari kategori yang populer
    
    Contoh untuk outfit casual weekend:
    - Pilih T-shirt casual dan celana yang cocok
    - Prioritaskan merek populer seperti Erigo
    - Pilih kombinasi warna yang matching
    `;

    // Step 3: Call Gemini API
    const messages = [{ role: 'user', parts: [{ text: prompt }] }];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const aiResponse = await axios.post(url, {
      generationConfig: { 
        temperature: 0.2,
        maxOutputTokens: 1024
      },
      contents: messages,
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    
    // Step 4: Parse AI response
    const reply = aiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text;
    let aiResult;
    
    try {
      // Extract JSON from response
      const jsonMatch = reply.match(/({[\s\S]*})/);
      aiResult = JSON.parse(jsonMatch ? jsonMatch[0] : reply);
    } catch (jsonError) {
      console.error('Error parsing JSON from AI response:', jsonError);
      
      // Fallback: return most popular products
      return res.json({
        products: topProducts,
        isAiRecommendation: false,
        message: 'Failed to parse AI recommendation, returning popular products instead'
      });
    }
    
    // Step 5: Fetch full product details for the recommended products
    let recommendedProducts = [];
    
    // First try to find by product IDs
    if (aiResult.productIds && aiResult.productIds.length > 0) {
      recommendedProducts = await Produk.find({
        product_id: { $in: aiResult.productIds }
      });
    }
    
    // If we don't have enough products by ID, try by name
    if (recommendedProducts.length < limit && aiResult.productNames && aiResult.productNames.length > 0) {
      // Create flexible regex queries for product names
      const nameQueries = aiResult.productNames.map(name => ({
        nama_produk: { $regex: new RegExp(name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i') }
      }));
      
      // Find products by name
      const nameProducts = await Produk.find({ $or: nameQueries });
      
      // Merge products, avoiding duplicates
      const existingIds = new Set(recommendedProducts.map(p => p.product_id?.toString()));
      for (const product of nameProducts) {
        if (!existingIds.has(product.product_id?.toString())) {
          recommendedProducts.push(product);
          existingIds.add(product.product_id?.toString());
        }
      }
    }
    
    // Step 6: If we still don't have enough products, use top products as fallback
    if (recommendedProducts.length < limit) {
      console.log(`Not enough recommended products found (${recommendedProducts.length}/${limit}), adding fallbacks`);
      
      // Only add top products that aren't already in the recommendations
      const existingIds = new Set(recommendedProducts.map(p => p.product_id?.toString()));
      for (const product of topProducts) {
        if (!existingIds.has(product.product_id?.toString())) {
          recommendedProducts.push(product);
          existingIds.add(product.product_id?.toString());
          
          // Stop once we have enough products
          if (recommendedProducts.length >= limit) break;
        }
      }
    }
    
    // Step 7: Add reasoning to each product from the AI response
    const recommendedProductsWithReasoning = recommendedProducts.map(product => {
      const productObject = product.toObject();
      productObject.reasoning = aiResult.reasoning || "Produk yang relevan dengan permintaan Anda";
      return productObject;
    });
    
    // Step 8: Return the results
    return res.json({
      products: recommendedProductsWithReasoning,
      reasoning: aiResult.reasoning,
      isAiRecommendation: true
    });
    
  } catch (error) {
    console.error('Error in AI product recommendation:', error);
    
    // Fallback to popular products if anything fails
    try {
      const topProducts = await Produk.find({ stok: { $gt: 0 } })
        .sort({ terjual: -1 })
        .limit(req.body.limit || 3);
        
      return res.json({
        products: topProducts,
        isAiRecommendation: false,
        message: 'Error in AI recommendation, returning popular products instead'
      });
    } catch (fallbackError) {
      return res.status(500).json({ 
        error: 'Failed to provide product recommendations',
        details: error.message
      });
    }
  }
});

module.exports = router;