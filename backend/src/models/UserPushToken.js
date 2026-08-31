import mongoose from 'mongoose'

const userPushTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true, trim: true },
    platform: { type: String, trim: true, default: 'web' },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

userPushTokenSchema.index({ user: 1, token: 1 }, { unique: true })

export default mongoose.models.UserPushToken ??
  mongoose.model('UserPushToken', userPushTokenSchema)

