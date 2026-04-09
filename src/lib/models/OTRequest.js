import mongoose from 'mongoose'

const OTRequestSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: { type: Date, required: true },
  hours: {
    type: Number,
    required: true,
    min: 0.5,
    max: 12
  },  // 0.5, 1, 1.5, 2, 2.5 ...
  reason: { type: String, required: true },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approverNote: { type: String },
  approvedAt: { type: Date },

}, { timestamps: true })

OTRequestSchema.index({ employeeId: 1, date: -1 })

export default mongoose.models.OTRequest ||
  mongoose.model('OTRequest', OTRequestSchema)
