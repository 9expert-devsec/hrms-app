import mongoose from 'mongoose'

const HolidaySchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['public', 'company'], default: 'public' },
}, { timestamps: true })

export default mongoose.models.Holiday || mongoose.model('Holiday', HolidaySchema)
