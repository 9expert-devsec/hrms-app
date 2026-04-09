import mongoose from 'mongoose'

const AttendanceRecordSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  date: { type: Date, required: true },  // store as date only (no time)

  clockIn: { type: Date },
  clockOut: { type: Date },

  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkShift' },
  shiftStart: { type: String },  // "08:00" — snapshot of shift at time of record
  shiftEnd: { type: String },    // "17:00"

  workHours: { type: Number, default: 0 },      // calculated
  lateMinutes: { type: Number, default: 0 },    // calculated
  otHours: { type: Number, default: 0 },        // from approved OTRequest

  status: {
    type: String,
    enum: ['present', 'late', 'absent', 'leave', 'holiday', 'weekend'],
    default: 'absent'
  },

  source: {
    type: String,
    enum: ['manual', 'finger_scan', 'api'],
    default: 'manual'
  },

  note: { type: String },
  location: { type: String },

}, { timestamps: true })

// Unique: one record per employee per day
AttendanceRecordSchema.index(
  { employeeId: 1, date: 1 },
  { unique: true }
)

export default mongoose.models.AttendanceRecord ||
  mongoose.model('AttendanceRecord', AttendanceRecordSchema)
