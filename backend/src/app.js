import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import buyerPreferenceRoutes from "./routes/buyerPreferenceRoutes.js";
import { errorHandler } from './middleware/errorMiddleware.js';
import propertyRoutes from './routes/propertyRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import adminBuyerRoutes from './routes/adminBuyerRoutes.js';

// Load environment variables
dotenv.config();

const app = express();

// Set security HTTP headers
app.use(helmet());

// Enable CORS with support for credentials and custom headers
app.use(
  cors({
    origin: true, 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Health Check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Backend API is running and healthy',
    timestamp: new Date()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/preferences', buyerPreferenceRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin/buyers', adminBuyerRoutes);

// Fallback for unhandled routes
app.all('*', (req, res, next) => {
  const err = new Error(`Can't find ${req.originalUrl} on this server!`);
  err.statusCode = 404;
  next(err);
});

// Centralized error handler middleware
app.use(errorHandler);

export default app;