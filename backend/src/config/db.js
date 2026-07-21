import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const connStr = process.env.MONGODB_URI;
    const conn = await mongoose.connect(connStr);

    console.log("Connected host:", conn.connection.host);
    console.log("Connected database:", conn.connection.name);

    const collections = await conn.connection.db.listCollections().toArray();
    console.log("✅ Collections:", collections.map(c => c.name));

  } catch (error) {
    console.error(error);
    throw error;
  }
};

export default connectDB;