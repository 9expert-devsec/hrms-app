import mongoose from "mongoose";

const { MONGODB_URI } = process.env;
if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI in environment variables");
}

// cache connection ระหว่าง hot-reload
let cached = global._mongoose;
if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

export default async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        // คุณจะใส่ dbName ที่นี่ก็ได้ หรือใน URI ก็ได้
        dbName: process.env.MONGODB_DB,
      })
      .then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}


console.log(process.env.MONGODB_URI)