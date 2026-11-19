import mongoose from 'mongoose'

/**
 * A holiday: one per calendar date. Managed on ตั้งค่าการลา › วันหยุด (and the
 * older attendance holidays page, which shares this collection). Leave
 * counting skips these dates (lib/leave/countLeave.js).
 *
 * `date` is date-only: UTC midnight of the Asia/Bangkok calendar date
 * (lib/leave/countLeave.js keyToDate). `type` is the holiday's kind —
 * 'public' (วันหยุดนักขัตฤกษ์) or 'company' (วันหยุดบริษัท); the leave-settings
 * API exposes it as `kind`. `createdBy`: the User who added it (unset on
 * records from before round 40 and on CSV imports).
 */
const HolidaySchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ['public', 'company'], default: 'public' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true })

export default mongoose.models.Holiday || mongoose.model('Holiday', HolidaySchema)
