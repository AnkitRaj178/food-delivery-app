import mongoose from 'mongoose'

const pendingOrderItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true, min: 0 },
    externalItemId: { type: String, trim: true },
  },
  { _id: false }
)

const pendingOrderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    items: {
      type: [pendingOrderItemSchema],
      required: true,
    },
    deliveryAddress: {
      line1: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      location: {
        type: {
          type: String,
          enum: ['Point'],
        },
        coordinates: {
          type: [Number],
        },
      },
    },
    subtotalCents: { type: Number, required: true, min: 0 },
    deliveryFeeCents: { type: Number, required: true, min: 0 },
    taxCents: { type: Number, min: 0, default: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    drivingDistanceMeters: { type: Number, min: 0 },
    /** True once the user has actually clicked Pay Now — drafted-and-abandoned orders stay false */
    paymentAttempted: {
      type: Boolean,
      default: false,
    },
    /** True when Stripe reports payment_failed OR the frontend detects redirect_status=failed */
    paymentFailed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
)

// Automatically expire pending orders after 1 hour to clean up DB
pendingOrderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 })

export default mongoose.models.PendingOrder ?? mongoose.model('PendingOrder', pendingOrderSchema)
