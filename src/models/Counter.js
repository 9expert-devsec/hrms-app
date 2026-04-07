import { Schema, model, models } from "mongoose";

const CounterSchema = new Schema({
  _id: String,              // key เช่น "employee"
  seq: { type: Number, default: 0 },
});

export default models.Counter || model("Counter", CounterSchema);