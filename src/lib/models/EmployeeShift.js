import mongoose from 'mongoose'

const EmployeeShiftSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  shiftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WorkShift',
    required: true
  },
  effectiveDate: { type: Date, required: true },
  endDate: { type: Date },  // null = ยังใช้อยู่
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
}, { timestamps: true })

// Index for fast lookup
EmployeeShiftSchema.index({ employeeId: 1, effectiveDate: -1 })

export default mongoose.models.EmployeeShift ||
  mongoose.model('EmployeeShift', EmployeeShiftSchema)
