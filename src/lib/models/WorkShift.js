import mongoose from 'mongoose'

const WorkShiftSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  startTime: { type: String, required: true },  // "08:00"
  endTime: { type: String, required: true },    // "17:00"
  lateThresholdMinutes: { type: Number, default: 15 },
  breakMinutes: { type: Number, default: 60 },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

export default mongoose.models.WorkShift || mongoose.model('WorkShift', WorkShiftSchema)
