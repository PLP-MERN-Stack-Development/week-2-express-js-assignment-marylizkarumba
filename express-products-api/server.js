// server.js - Advanced Express server with middleware and error handling

// Import required modules
const express = require('express');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Custom Error Classes
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

// Async error wrapper function
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Sample in-memory products database
let products = [
  {
    id: '1',
    name: 'Laptop',
    description: 'High-performance laptop with 16GB RAM',
    price: 12000,
    category: 'electronics',
    inStock: true,
    createdAt: new Date('2025-01-15T10:00:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z')
  },
  {
    id: '2',
    name: 'Smartphone',
    description: 'Latest model with 128GB storage',
    price: 80000,
    category: 'electronics',
    inStock: true,
    createdAt: new Date('2025-01-16T11:00:00Z'),
    updatedAt: new Date('2025-01-16T11:00:00Z')
  },
  {
    id: '3',
    name: 'Coffee Maker',
    description: 'Programmable coffee maker with timer',
    price: 5000,
    category: 'kitchen',
    inStock: false,
    createdAt: new Date('2025-01-17T09:00:00Z'),
    updatedAt: new Date('2025-01-17T09:00:00Z')
  },
  {
    id: '4',
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse with long battery life',
    price: 2500,
    category: 'electronics',
    inStock: true,
    createdAt: new Date('2025-01-18T14:00:00Z'),
    updatedAt: new Date('2025-01-18T14:00:00Z')
  },
  {
    id: '5',
    name: 'Blender',
    description: 'High-speed blender for smoothies and shakes',
    price: 7500,
    category: 'kitchen',
    inStock: true,
    createdAt: new Date('2025-01-19T12:00:00Z'),
    updatedAt: new Date('2025--01-19T12:00:00Z')
  }
];

// MIDDLEWARE IMPLEMENTATIONS

// 1. Custom Logger Middleware
const logger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  console.log(`[${timestamp}] ${method} ${url} - User-Agent: ${userAgent}`);
  
  // Log response time
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${timestamp}] ${method} ${url} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
};

// 2. JSON Body Parser Middleware
const jsonParser = express.json({ limit: '10mb' });

// 3. Authentication Middleware
const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
  
  // For demo purposes, we'll accept any API key that starts with 'api-key-'
  // In production, you'd validate against a database or service
  if (!apiKey) {
    return next(new AuthenticationError('API key is required. Please provide x-api-key header.'));
  }
  
  if (!apiKey.startsWith('api-key-')) {
    return next(new AuthenticationError('Invalid API key format. Must start with "api-key-"'));
  }
  
  // Add user info to request (in real app, you'd fetch from database)
  req.user = { id: 'user-123', apiKey };
  next();
};

// 4. Product Validation Middleware
const validateProduct = (req, res, next) => {
  const errors = [];
  const { name, description, price, category, inStock } = req.body;
  
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Name is required and must be at least 2 characters long');
  }
  
  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    errors.push('Description is required and must be at least 10 characters long');
  }
  
  if (price === undefined || typeof price !== 'number' || price < 0) {
    errors.push('Price is required and must be a non-negative number');
  }
  
  if (!category || typeof category !== 'string') {
    errors.push('Category is required and must be a string');
  }
  
  if (inStock === undefined || typeof inStock !== 'boolean') {
    errors.push('InStock is required and must be a boolean');
  }
  
  if (errors.length > 0) {
    return next(new ValidationError('Product validation failed', errors));
  }
  
  next();
};

// Apply middleware
app.use(logger);
app.use(jsonParser);

// Helper functions
const getPaginationParams = (req) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
};

const filterProducts = (products, filters) => {
  let filtered = [...products];
  
  if (filters.category) {
    filtered = filtered.filter(p => 
      p.category.toLowerCase().includes(filters.category.toLowerCase())
    );
  }
  
  if (filters.inStock !== undefined) {
    filtered = filtered.filter(p => p.inStock === filters.inStock);
  }
  
  if (filters.minPrice !== undefined) {
    filtered = filtered.filter(p => p.price >= filters.minPrice);
  }
  
  if (filters.maxPrice !== undefined) {
    filtered = filtered.filter(p => p.price <= filters.maxPrice);
  }
  
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    filtered = filtered.filter(p => 
      p.name.toLowerCase().includes(searchTerm) ||
      p.description.toLowerCase().includes(searchTerm)
    );
  }
  
  return filtered;
};

// ROUTES

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the Advanced Product API!',
    version: '2.0.0',
    endpoints: {
      'GET /': 'API information',
      'GET /api/products': 'List products with filtering and pagination',
      'GET /api/products/search': 'Search products by name',
      'GET /api/products/stats': 'Get product statistics',
      'GET /api/products/:id': 'Get specific product',
      'POST /api/products': 'Create product (requires API key)',
      'PUT /api/products/:id': 'Update product (requires API key)',
      'DELETE /api/products/:id': 'Delete product (requires API key)'
    },
    authentication: 'Include x-api-key header with value starting with "api-key-"',
    queryParameters: {
      filtering: 'category, inStock, minPrice, maxPrice',
      pagination: 'page, limit',
      search: 'q (query string)'
    }
  });
});

// GET /api/products - List products with filtering and pagination
app.get('/api/products', asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req);
  
  const filters = {
    category: req.query.category,
    inStock: req.query.inStock === 'true' ? true : req.query.inStock === 'false' ? false : undefined,
    minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
    maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
    search: req.query.search
  };
  
  let filteredProducts = filterProducts(products, filters);
  
  // Sort products
  const sortBy = req.query.sortBy || 'createdAt';
  const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
  
  filteredProducts.sort((a, b) => {
    if (sortBy === 'price' || sortBy === 'createdAt' || sortBy === 'updatedAt') {
      const aVal = sortBy === 'price' ? a.price : new Date(a[sortBy]);
      const bVal = sortBy === 'price' ? b.price : new Date(b[sortBy]);
      return sortOrder * (aVal > bVal ? 1 : -1);
    } else {
      return sortOrder * a[sortBy]?.localeCompare(b[sortBy] || '');
    }
  });
  
  const total = filteredProducts.length;
  const paginatedProducts = filteredProducts.slice(skip, skip + limit);
  
  res.json({
    success: true,
    data: paginatedProducts,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage: skip + limit < total,
      hasPrevPage: page > 1
    },
    filters: Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== undefined))
  });
}));

// GET /api/products/search - Search products by name
app.get('/api/products/search', asyncHandler(async (req, res) => {
  const query = req.query.q;
  
  if (!query) {
    throw new ValidationError('Search query is required. Use ?q=searchterm');
  }
  
  const searchResults = products.filter(product =>
    product.name.toLowerCase().includes(query.toLowerCase()) ||
    product.description.toLowerCase().includes(query.toLowerCase())
  );
  
  res.json({
    success: true,
    query,
    count: searchResults.length,
    data: searchResults
  });
}));

// GET /api/products/stats - Get product statistics
app.get('/api/products/stats', asyncHandler(async (req, res) => {
  const stats = {
    total: products.length,
    inStock: products.filter(p => p.inStock).length,
    outOfStock: products.filter(p => !p.inStock).length,
    categories: {},
    priceStats: {
      min: Math.min(...products.map(p => p.price)),
      max: Math.max(...products.map(p => p.price)),
      average: products.reduce((sum, p) => sum + p.price, 0) / products.length
    }
  };
  
  // Count by category
  products.forEach(product => {
    stats.categories[product.category] = (stats.categories[product.category] || 0) + 1;
  });
  
  res.json({
    success: true,
    data: stats
  });
}));

// GET /api/products/:id - Get specific product
app.get('/api/products/:id', asyncHandler(async (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  
  if (!product) {
    throw new NotFoundError('Product not found');
  }
  
  res.json({
    success: true,
    data: product
  });
}));

// POST /api/products - Create new product (requires authentication)
app.post('/api/products', authenticate, validateProduct, asyncHandler(async (req, res) => {
  const newProduct = {
    id: uuidv4(),
    name: req.body.name.trim(),
    description: req.body.description.trim(),
    price: req.body.price,
    category: req.body.category.toLowerCase().trim(),
    inStock: req.body.inStock,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  products.push(newProduct);
  
  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: newProduct
  });
}));

// PUT /api/products/:id - Update product (requires authentication)
app.put('/api/products/:id', authenticate, validateProduct, asyncHandler(async (req, res) => {
  const productIndex = products.findIndex(p => p.id === req.params.id);
  
  if (productIndex === -1) {
    throw new NotFoundError('Product not found');
  }
  
  const updatedProduct = {
    ...products[productIndex],
    name: req.body.name.trim(),
    description: req.body.description.trim(),
    price: req.body.price,
    category: req.body.category.toLowerCase().trim(),
    inStock: req.body.inStock,
    updatedAt: new Date()
  };
  
  products[productIndex] = updatedProduct;
  
  res.json({
    success: true,
    message: 'Product updated successfully',
    data: updatedProduct
  });
}));

// DELETE /api/products/:id - Delete product (requires authentication)
app.delete('/api/products/:id', authenticate, asyncHandler(async (req, res) => {
  const productIndex = products.findIndex(p => p.id === req.params.id);
  
  if (productIndex === -1) {
    throw new NotFoundError('Product not found');
  }
  
  const deletedProduct = products.splice(productIndex, 1)[0];
  
  res.json({
    success: true,
    message: 'Product deleted successfully',
    data: deletedProduct
  });
}));

// Global Error Handling Middleware
const globalErrorHandler = (err, req, res, next) => {
  // Set default error values
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log error for debugging
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Send error response
  const errorResponse = {
    success: false,
    status: err.status,
    message: err.message
  };

  // Add additional error details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // Add validation errors if present
  if (err.errors && err.errors.length > 0) {
    errorResponse.errors = err.errors;
  }

  res.status(err.statusCode).json(errorResponse);
};

// Handle undefined routes (404)
app.all('*', (req, res, next) => {
  next(new NotFoundError(`Route ${req.originalUrl} not found`));
});

// Apply global error handler
app.use(globalErrorHandler);

// Start server
app.listen(PORT, () => {
  console.log(` Server running on http://localhost:${PORT}`);
  console.log(` API Documentation available at http://localhost:${PORT}`);
  console.log(` Example: GET http://localhost:${PORT}/api/products?category=electronics&page=1&limit=5`);
  console.log(` Authentication: Include header "x-api-key: api-key-your-key-here"`);
});

module.exports = app;