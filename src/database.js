import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connection = async () => {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
    }).then((mongooseInstance) => {
      // Mensaje solo la primera vez que se conecta
      const { host, port } = mongooseInstance.connection;
      console.log(`Database is connected on ${host} - ${port}`);
      return mongooseInstance;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
};

export default connection;