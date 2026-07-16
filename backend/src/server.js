import dotenv from 'dotenv';
import app from './app.js';
import connectDB from './config/db.js';

// Handle Uncaught Exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down gracefully...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB()
  .then(() => {
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 TerraGuide Auth Server running on port ${PORT}`);
    });

    // Handle Unhandled Rejections
    process.on('unhandledRejection', (err) => {
      console.error('💥 UNHANDLED REJECTION! Shutting down server...');
      console.error(err.name, err.message);
      server.close(() => {
        process.exit(1);
      });
    });
  })
  .catch((err) => {
    console.error('💥 DATABASE CONNECTION FAILED. Shutting down...');
    console.error(err);
    process.exit(1);
  });
