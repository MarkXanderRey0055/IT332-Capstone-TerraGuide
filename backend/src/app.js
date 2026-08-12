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
import cabinetRoutes from './routes/cabinetRoutes.js';
import aiUsageRoutes from './routes/aiUsageRoutes.js';

dotenv.config();

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: true, 
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Backend API is running and healthy',
    timestamp: new Date()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/preferences', buyerPreferenceRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin/buyers', adminBuyerRoutes);
app.use('/api/cabinets', cabinetRoutes);
app.use('/api/ai', aiUsageRoutes);

app.all('*', (req, res, next) => {
  const err = new Error(`Can't find ${req.originalUrl} on this server!`);
  err.statusCode = 404;
  next(err);
});

app.use(errorHandler);

export default app;