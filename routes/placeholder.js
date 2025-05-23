// routes/placeholder.js
const express = require('express');
const router = express.Router();

/**
 * Endpoint to serve placeholder images
 * Usage: /api/placeholder/width/height
 */
router.get('/:width/:height', async (req, res) => {
  try {
    const { width, height } = req.params;
    const text = req.query.text || '';
    const bgColor = req.query.bg || 'f5f5f5';
    const textColor = req.query.color || '333333';

    // Check if dimensions are valid
    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0 || width > 2000 || height > 2000) {
      return res.status(400).json({ error: 'Invalid image dimensions' });
    }

    // Generate SVG placeholder
    const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#${bgColor}"/>
      <text 
        x="50%" 
        y="50%" 
        font-family="Arial, sans-serif" 
        font-size="${Math.min(parseInt(width), parseInt(height)) / 10}px" 
        fill="#${textColor}" 
        text-anchor="middle" 
        dominant-baseline="middle"
      >
        ${text || `${width}×${height}`}
      </text>
    </svg>`;

    // Send SVG as response
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.send(svg);
  } catch (error) {
    console.error('Error generating placeholder:', error);
    res.status(500).json({ error: 'Failed to generate placeholder image' });
  }
});

module.exports = router;