// search-suggestions.js - With Rate Limiting and Robust Fallbacks

const express = require('express');
const router = express.Router();
const axios = require('axios');
const Produk = require('../../models/produk');
require('dotenv').config();

// Get API key from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Simple in-memory cache for API responses
const apiCache = {
  recommendations: new Map(),
  suggestions: new Map()
};

// Simple rate limiting implementation
const rateLimiter = {
  tokens: 10, // Start with tokens
  lastRefill: Date.now(),
  refillRate: 10, // Tokens per minute
  maxTokens: 10,
  
  // Check if we can make a request
  canMakeRequest() {
    this.refillTokens();
    return this.tokens > 0;
  },
  
  // Use a token
  useToken() {
    this.tokens -= 1;
    return this.tokens;
  },
  
  // Refill tokens based on time passed
  refillTokens() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    
    if (timePassed > 0) {
      // Convert to minutes and multiply by refill rate
      const tokensToAdd = Math.floor((timePassed / 60000) * this.refillRate);
      
      if (tokensToAdd > 0) {
        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
        this.lastRefill = now;
      }
    }
  }
};

/**
 * Call Gemini API with rate limiting and retries
 * @param {string} prompt - The prompt to send
 * @param {Object} options - Options for the API call
 * @returns {Promise<Object>} - The API response
 */
async function callGeminiAPI(prompt, options = {}) {
  const {
    temperature = 0.2,
    maxTokens = 1024,
    timeout = 5000,
    maxRetries = 2,
    retryDelay = 1000,
    cacheKey = null,
    cacheMap = null
  } = options;
  
  // Check cache if provided
  if (cacheKey && cacheMap && cacheMap.has(cacheKey)) {
    console.log(`Cache hit for key: ${cacheKey}`);
    return cacheMap.get(cacheKey);
  }
  
  // Check rate limit
  if (!rateLimiter.canMakeRequest()) {
    throw new Error('Rate limit exceeded. Try again later.');
  }
  
  // Use a token
  rateLimiter.useToken();
  
  let lastError = null;
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      const messages = [{ role: 'user', parts: [{ text: prompt }] }];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
      
      const response = await axios.post(url, {
        generationConfig: { 
          temperature: temperature,
          maxOutputTokens: maxTokens
        },
        contents: messages,
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: timeout
      });
      
      // Extract JSON from response
      const reply = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      // Extract JSON object from the response
      const jsonMatch = reply.match(/({[\s\S]*})/);
      const result = JSON.parse(jsonMatch ? jsonMatch[0] : reply);
      
      // Save to cache if provided
      if (cacheKey && cacheMap) {
        cacheMap.set(cacheKey, result);
      }
      
      return result;
    } catch (error) {
      console.error(`Attempt ${retries + 1} failed: ${error.message}`);
      lastError = error;
      
      // If status code is 429 (rate limit) or 500+, retry
      const status = error.response?.status;
      if ((status === 429 || status >= 500) && retries < maxRetries) {
        // Exponential backoff
        const delay = retryDelay * Math.pow(2, retries);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
        continue;
      }
      
      // Other errors or max retries reached, throw
      break;
    }
  }
  
  throw lastError || new Error('Failed to call Gemini API after retries');
}

/**
 * Get basic related terms for a query
 * @param {string} query - The search query
 * @returns {Array} - Array of related terms
 */
function getBasicRelatedTerms(query) {
  const lowercaseQuery = query.toLowerCase();
  
  // Basic dictionary of related terms
  const relatedTermsMap = {
    'baju': ['kaos', 't-shirt', 'kemeja'],
    'kaos': ['baju', 't-shirt', 'polo'],
    'celana': ['jeans', 'chino', 'cargo'],
    'jaket': ['hoodie', 'sweater', 'cardigan'],
    'sepatu': ['sneakers', 'boots', 'sandal'],
    'tas': ['backpack', 'tote bag', 'sling bag'],
    'topi': ['cap', 'hat', 'beanie']
  };
  
  // Check if our query matches any key or part of the key
  for (const [key, terms] of Object.entries(relatedTermsMap)) {
    if (lowercaseQuery.includes(key) || key.includes(lowercaseQuery)) {
      return terms;
    }
  }
  
  // Default related terms for fashion
  return ['baju', 'celana', 'sepatu', 'tas'];
}

/**
 * Generate suggestions for subjective queries using rule-based approach
 * Used as fallback when AI is rate limited
 * @param {string} query - The search query
 * @param {Array} products - List of products to search through
 * @returns {Object} - Recommendations object
 */
function generateFallbackRecommendations(query, products) {
  const queryLower = query.toLowerCase();
  const words = queryLower.split(/\s+/);
  
  // Extract descriptive terms and categories
  const descriptiveTerms = [
    'keren', 'bagus', 'cantik', 'stylish', 'trendi', 'trendy', 'modern',
    'casual', 'elegant', 'elegan', 'mewah', 'simple', 'simpel', 'unik',
    'vintage', 'retro', 'klasik', 'minimalis', 'populer', 'terbaru',
    'hits', 'terbaik', 'favorit', 'recommended', 'murah', 'mahal',
    'terjangkau', 'branded', 'original', 'berkualitas', 'premium'
  ];
  
  // Identify descriptive terms in the query
  const queryDescriptors = words.filter(word => 
    descriptiveTerms.includes(word)
  );
  
  // Identify possible product categories
  const categories = ['baju', 'kaos', 't-shirt', 'kemeja', 'celana', 'jeans', 
                     'jaket', 'hoodie', 'sepatu', 'tas', 'topi', 'dress', 'rok'];
  
  const queryCategories = words.filter(word => 
    categories.includes(word)
  );
  
  // Create a simple query analysis
  let queryAnalysis = 'Pencarian untuk ';
  
  if (queryCategories.length > 0) {
    queryAnalysis += queryCategories.join(', ');
  } else {
    queryAnalysis += 'produk fashion';
  }
  
  if (queryDescriptors.length > 0) {
    queryAnalysis += ' dengan karakteristik: ' + queryDescriptors.join(', ');
  }
  
  // Score products based on matches to query terms
  const scoredProducts = products.map(product => {
    let score = 0;
    const productName = product.nama_produk?.toLowerCase() || '';
    const productCategory = product.kategori?.toLowerCase() || '';
    const productDesc = product.deskripsi?.toLowerCase() || '';
    
    // Score category matches
    if (queryCategories.length > 0) {
      queryCategories.forEach(cat => {
        if (productCategory.includes(cat)) score += 5;
        if (productName.includes(cat)) score += 3;
      });
    }
    
    // Score descriptive term matches
    queryDescriptors.forEach(term => {
      if (productName.includes(term)) score += 4;
      if (productDesc.includes(term)) score += 2;
    });
    
    // Add some score for popularity
    const sold = parseInt(product.terjual) || 0;
    score += Math.min(3, sold / 50); // Cap at 3 points for sales
    
    // Add score for rating
    const rating = parseFloat(product.rating) || 0;
    score += rating;
    
    return { product, score };
  });
  
  // Sort by score and take top results
  scoredProducts.sort((a, b) => b.score - a.score);
  
  // Create recommendation reasons
  const recommendations = scoredProducts.slice(0, 10).map(({ product, score }) => {
    // Generate a reason based on product attributes
    let reason = '';
    
    // Check if product matches category
    if (queryCategories.length > 0 && 
        queryCategories.some(cat => 
          product.kategori?.toLowerCase().includes(cat) || 
          product.nama_produk?.toLowerCase().includes(cat))) {
      reason += `Sesuai dengan kategori yang Anda cari. `;
    }
    
    // Check for descriptive terms
    if (queryDescriptors.length > 0) {
      reason += `Produk ini ${queryDescriptors[0]} berdasarkan ulasan pembeli. `;
    }
    
    // Add info about popularity
    const sold = parseInt(product.terjual) || 0;
    if (sold > 50) {
      reason += `Telah terjual ${product.terjual} kali dan populer di kalangan pembeli. `;
    }
    
    // Add info about rating
    const rating = parseFloat(product.rating) || 0;
    if (rating >= 4.5) {
      reason += `Memiliki rating tinggi ${product.rating}. `;
    }
    
    return {
      ...product.toObject(),
      aiReason: reason || 'Produk yang mungkin sesuai dengan pencarian Anda.'
    };
  });
  
  return {
    queryAnalysis,
    recommendedProducts: recommendations
  };
}

/**
 * Get a sample of products from the database
 * @param {Object} options - Query options
 * @returns {Promise<Array>} - Array of products
 */
async function getSampleProducts(options = {}) {
  const {
    limit = 100,
    filter = { stok: { $gt: 0 } },
    sort = { terjual: -1 }
  } = options;
  
  try {
    return await Produk.find(filter)
      .sort(sort)
      .limit(limit);
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

/**
 * Generate typo corrections and search suggestions without AI
 * Used as fallback when AI is rate limited
 * @param {string} query - The search query
 * @param {Array} products - Products to search through
 * @param {number} limit - Maximum number of suggestions
 * @returns {Object} - Suggestions object
 */
function generateFallbackSuggestions(query, products, limit = 5) {
  // Simple typo corrections for common cases
  const commonTypos = {
    'bsju': 'baju',
    'koas': 'kaos',
    'cealana': 'celana',
    'celna': 'celana',
    'jket': 'jaket',
    'sptau': 'sepatu',
    'seperti': 'sepatu',
    'topu': 'topi'
  };
  
  let correctedQuery = '';
  
  // Check for exact matches in typo dictionary
  if (commonTypos[query.toLowerCase()]) {
    correctedQuery = commonTypos[query.toLowerCase()];
  } else {
    // Try to detect typos by similarity
    // This is a simple implementation - could be improved with more sophisticated algorithms
    const words = query.toLowerCase().split(/\s+/);
    const correctedWords = words.map(word => {
      // Check if word is in common typos
      if (commonTypos[word]) {
        return commonTypos[word];
      }
      
      // Check similarity with common fashion terms
      const fashionTerms = [
        'baju', 'kaos', 'celana', 'jaket', 'sepatu', 'tas', 'topi', 
        'kemeja', 'jeans', 'hoodie', 'dress', 'rok', 'sweater'
      ];
      
      // Simple character similarity
      for (const term of fashionTerms) {
        if (word.length >= 3 && term.includes(word.substring(0, 3))) {
          return term;
        }
      }
      
      return word;
    });
    
    const corrected = correctedWords.join(' ');
    if (corrected !== query.toLowerCase()) {
      correctedQuery = corrected;
    }
  }
  
  // Generate search suggestions
  let suggestions = [];
  
  // Use corrected query if available, otherwise use original
  const baseQuery = correctedQuery || query.toLowerCase();
  const baseWords = baseQuery.split(/\s+/);
  const mainTerm = baseWords[0]; // Use first word as main term
  
  // Add category-based suggestions
  const basicSuggestions = [
    `${mainTerm} Pria`,
    `${mainTerm} Wanita`,
    `${mainTerm} Casual`,
    `${mainTerm} Formal`,
    `${mainTerm} Premium`,
    `${mainTerm} Terbaru`,
    `${mainTerm} Murah`
  ];
  
  // Add product-based suggestions from existing products
  const productSuggestions = products
    .filter(product => {
      const name = product.nama_produk?.toLowerCase() || '';
      return name.includes(mainTerm);
    })
    .slice(0, 5)
    .map(product => product.nama_produk);
  
  // Combine suggestions and remove duplicates
  suggestions = [...new Set([...productSuggestions, ...basicSuggestions])].slice(0, limit);
  
  return {
    suggestions,
    correctedQuery,
    relatedTerms: getBasicRelatedTerms(baseQuery)
  };
}

/**
 * Endpoint for subjective query recommendations (like "tas keren")
 * Provides AI-powered product recommendations based on subjective descriptions
 */
router.post('/ai-recommendations', async (req, res) => {
  try {
    const { query, limit = 10 } = req.body;
    
    if (!query || query.length < 3) {
      return res.status(400).json({ 
        success: false,
        error: 'Query must be at least 3 characters'
      });
    }

    // Create cache key
    const cacheKey = `${query.toLowerCase()}_${limit}`;
    
    // Try to get from cache first
    if (apiCache.recommendations.has(cacheKey)) {
      return res.json({
        success: true,
        cached: true,
        ...apiCache.recommendations.get(cacheKey)
      });
    }
    
    // Get all available products
    const allProducts = await getSampleProducts({ limit: 100 });
    if (allProducts.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'No products available in database'
      });
    }
    
    // Create product catalog for AI context
    const productCatalog = allProducts.map(product => ({
      id: product.product_id,
      name: product.nama_produk,
      category: product.kategori || "Uncategorized",
      price: product.harga,
      description: product.deskripsi || "",
      rating: product.rating || 0,
      sold: product.terjual || 0
    }));
    
    // Try to use AI recommendations
    try {
      // Create prompt for AI to understand subjective query
      const prompt = `
      Kamu adalah AI yang ahli dalam fashion dan memahami tren fashion Indonesia. 
      Seorang pengguna mencari: "${query}".
      
      Tugas:
      1. Analisis apa yang pengguna inginkan berdasarkan query tersebut.
      2. Pilih 5-10 produk dari katalog yang paling cocok dengan maksud pengguna.
      3. Berikan alasan kenapa produk tersebut direkomendasikan.
      
      Katalog produk (${productCatalog.length} item):
      ${JSON.stringify(productCatalog.slice(0, Math.min(productCatalog.length, 40)))}
      
      Contoh analisis:
      - "tas keren" = pengguna mencari tas dengan desain stylish, trendy, dan sesuai tren terbaru
      - "baju stylish cowok" = pengguna mencari pakaian pria dengan desain fashionable dan trendy
      - "celana jeans bagus" = pengguna mencari celana jeans berkualitas dengan desain menarik
      
      Berikan respons dalam format JSON:
      {
        "queryAnalysis": "Analisis singkat tentang maksud pencarian user",
        "recommendedProducts": [
          {
            "id": "ID produk",
            "reason": "Alasan kenapa produk ini direkomendasikan"
          }
        ]
      }
      `;

      // Call Gemini API with cache
      const aiResult = await callGeminiAPI(prompt, {
        temperature: 0.4,
        maxTokens: 1500,
        timeout: 10000,
        cacheKey,
        cacheMap: apiCache.recommendations
      });
      
      // Find the actual product details for recommended products
      const recommendedProductIds = aiResult.recommendedProducts.map(p => p.id);
      const recommendedProducts = await Produk.find({
        product_id: { $in: recommendedProductIds },
        stok: { $gt: 0 }
      });
      
      // Combine product details with AI reasoning
      const enhancedRecommendations = recommendedProducts.map(product => {
        const aiRec = aiResult.recommendedProducts.find(p => p.id === product.product_id);
        return {
          ...product.toObject(),
          aiReason: aiRec ? aiRec.reason : null
        };
      });
      
      // Cache the result
      const result = {
        queryAnalysis: aiResult.queryAnalysis,
        recommendedProducts: enhancedRecommendations
      };
      
      apiCache.recommendations.set(cacheKey, result);
      
      // Return AI analysis and enhanced product details
      return res.json({
        success: true,
        ...result
      });
      
    } catch (error) {
      console.warn(`AI failed, using fallback recommendations: ${error.message}`);
      
      // Use fallback recommendations
      const fallbackResult = generateFallbackRecommendations(query, allProducts);
      
      // Cache the fallback result too
      apiCache.recommendations.set(cacheKey, fallbackResult);
      
      return res.json({
        success: true,
        fallback: true,
        ...fallbackResult
      });
    }
    
  } catch (error) {
    console.error('Error in product recommendations:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to provide product recommendations',
      details: error.message
    });
  }
});

/**
 * Main endpoint for search suggestions and typo correction
 * Provides search suggestions, corrects typos, and offers related terms
 */
router.post('/', async (req, res) => {
  try {
    const { query, limit = 5, includeRelatedTerms = true } = req.body;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ 
        success: false,
        error: 'Query must be at least 2 characters' 
      });
    }
    
    // Create cache key
    const cacheKey = `${query.toLowerCase()}_${limit}_${includeRelatedTerms}`;
    
    // Try to get from cache first
    if (apiCache.suggestions.has(cacheKey)) {
      return res.json({
        success: true,
        cached: true,
        ...apiCache.suggestions.get(cacheKey)
      });
    }

    // First check for direct product matches
    const directMatches = await Produk.find({
      $or: [
        { nama_produk: { $regex: new RegExp(query, 'i') } },
        { kategori: { $regex: new RegExp(query, 'i') } },
        { deskripsi: { $regex: new RegExp(query, 'i') } }
      ],
      stok: { $gt: 0 }
    }).limit(50);

    // If we have enough direct matches, return them immediately
    if (directMatches.length >= limit && !includeRelatedTerms) {
      const suggestions = directMatches
        .slice(0, limit)
        .map(product => product.nama_produk);
      
      const result = {
        suggestions,
        correctedQuery: '',
        aiGenerated: false
      };
      
      // Save to cache
      apiCache.suggestions.set(cacheKey, result);
      
      return res.json({
        success: true,
        ...result
      });
    }

    // Try to use AI for suggestions and typo correction
    try {
      // Get a sample of products for the AI context
      const allProducts = await getSampleProducts({ limit: 100 });
      
      // Create product catalog for context
      const productCatalog = allProducts.map(product => ({
        name: product.nama_produk,
        category: product.kategori || "Uncategorized",
      }));

      // Create popular categories list
      const categories = [...new Set(allProducts.map(p => p.kategori).filter(Boolean))];

      // Create prompt for AI - Enhanced with keyword expansion
      const prompt = `
      Kamu adalah asisten AI untuk toko fashion online. Pengguna mengetik: "${query}"
      
      Tugas:
      1. Periksa apakah ada kemungkinan typo/kesalahan ketik.
      2. Berikan 5-${limit} saran pencarian yang relevan berdasarkan konteks fashion.
      3. Jika kamu mendeteksi kesalahan ketik, berikan koreksi.
      ${includeRelatedTerms ? '4. Berikan 2-3 istilah terkait untuk ekspansi kata kunci.' : ''}
      
      Informasi toko:
      - Kategori produk: ${categories.join(', ')}
      - Sampel produk (${productCatalog.length}): ${JSON.stringify(productCatalog.slice(0, Math.min(productCatalog.length, 40)))}
      
      Berikan respons dalam format JSON:
      {
        "suggestions": ["saran1", "saran2", "saran3", "saran4", "saran5"],
        "correctedQuery": "koreksi typo (jika ada, jika tidak typo biarkan string kosong)"
        ${includeRelatedTerms ? ',"relatedTerms": ["term1", "term2", "term3"]' : ''}
      }
      
      Contoh:
      - Jika pengguna menulis "kaos" → berikan variasi saran seperti "Kaos Pria", "Kaos Wanita", "Kaos Oversize", dll.
      - Jika pengguna menulis "cealana" (typo) → berikan koreksi "celana" dan saran seperti "Celana Jeans", "Celana Cargo", dll.
      - Jika pengguna menulis "bsju" (typo serius) → berikan koreksi "baju" dan saran seperti "Baju Pria", "Baju Wanita", dll.
      ${includeRelatedTerms ? '- Berikan istilah terkait seperti "t-shirt", "kemeja", "jaket" untuk "baju".' : ''}
      `;

      // Call Gemini API with cache
      const aiResult = await callGeminiAPI(prompt, {
        cacheKey,
        cacheMap: apiCache.suggestions
      });
      
      // Save original query to localStorage if there's a correction
      if (aiResult.correctedQuery && aiResult.correctedQuery !== query) {
        // This would need to be handled on the frontend
      }
      
      // Cache the result
      const result = {
        suggestions: aiResult.suggestions || [],
        correctedQuery: aiResult.correctedQuery || '',
        relatedTerms: includeRelatedTerms ? aiResult.relatedTerms || [] : [],
        aiGenerated: true
      };
      
      apiCache.suggestions.set(cacheKey, result);
      
      // Return the AI suggestions
      return res.json({
        success: true,
        ...result
      });
      
    } catch (error) {
      console.warn(`AI failed, using fallback suggestions: ${error.message}`);
      
      // Use fallback suggestions
      const allProducts = await getSampleProducts({ limit: 100 });
      const fallbackResult = generateFallbackSuggestions(query, allProducts, limit);
      
      // Cache the fallback result
      apiCache.suggestions.set(cacheKey, {
        ...fallbackResult,
        aiGenerated: false
      });
      
      // Return fallback suggestions
      return res.json({
        success: true,
        fallback: true,
        ...fallbackResult,
        aiGenerated: false
      });
    }
    
  } catch (error) {
    console.error('Error in search suggestions:', error);
    
    // Last resort fallback
    try {
      const words = req.body.query.split(' ');
      const mainKeyword = words[words.length - 1];
      
      const fallbackSuggestions = [
        `${mainKeyword} Pria`,
        `${mainKeyword} Wanita`,
        `${mainKeyword} Premium`,
        `${mainKeyword} Terbaru`,
        `${mainKeyword} Terlaris`
      ];
      
      return res.json({
        success: true,
        fallback: true,
        emergency: true,
        suggestions: fallbackSuggestions,
        correctedQuery: '',
        relatedTerms: req.body.includeRelatedTerms ? getBasicRelatedTerms(req.body.query) : [],
        aiGenerated: false,
        message: 'Error in AI suggestions, returning basic suggestions'
      });
    } catch (fallbackError) {
      return res.status(500).json({ 
        success: false,
        error: 'Failed to provide search suggestions',
        details: error.message
      });
    }
  }
});

// Export the router
module.exports = router;