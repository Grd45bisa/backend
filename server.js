const express = require('express');
const mongoose = require('mongoose');
const winston = require('winston');
const cors = require('cors');
require('dotenv').config();

const produkRoute = require('./routes/produk');
const ulasanRoute = require('./routes/ulasan');
const statistikRoute = require('./routes/statistik');
const chatbotRoute = require('./routes/Chatbot');
const sentimenRoute = require('./routes/Sentimen'); 
const analyzeRoutes = require('./routes/analyze');
const placeholderRoutes = require('./routes/placeholder');
const productRecommendationRoutes = require('./routes/ai/product-recommendation');
const SearchSuggestions = require('./routes/ai/search-suggestions');

const app = express();
const PORT = process.env.PORT || 5000;

// Logger
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

// CORS Configuration for Railway
const corsOptions = {
  origin: [
    'http://localhost:5173', // Frontend URL in development
    'http://127.0.0.1:5173', // Localhost variant
    'https://backend.railway.internal' // Internal Railway backend URL
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin', 
    'X-Requested-With', 
    'Content-Type', 
    'Accept', 
    'Authorization',
    'Cache-Control', 
    'cache-control'
  ],
  credentials: true,
  optionsSuccessStatus: 204
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => logger.info('✅ MongoDB terkoneksi'))
.catch((err) => {
  logger.error('MongoDB connection error:', err);
  process.exit(1);
});

// Connection monitoring
mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected, attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected successfully');
});

// Routes
app.use('/api/produk', produkRoute);
app.use('/api/ulasan', ulasanRoute);
app.use('/api/statistik', statistikRoute);
app.use('/api/chatbot', chatbotRoute);
app.use('/api/sentimen', sentimenRoute);
app.use('/api/analyze', analyzeRoutes);
app.use('/api/placeholder', placeholderRoutes);
app.use('/api/ai/product-recommendation', productRecommendationRoutes);
app.use('/api/ai/search-suggestions', SearchSuggestions);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error in ${req.method} ${req.url}: ${err.message}`);
  logger.error(err.stack);
  res.status(500).json({ error: 'Server error, please try again later' });
});

// Start Server
app.listen(PORT, () => {
  logger.info(`✅ Server berjalan di port http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {  
  mongoose.connection.close(() => {
    logger.info('MongoDB connection closed due to app termination');
    process.exit(0);
  });
});
