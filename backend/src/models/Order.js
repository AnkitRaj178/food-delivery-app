import mongoose from 'mongoose'

const orderItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPriceCents: { type: Number, required: true, min: 0 },
    externalItemId: { type: String, trim: true },
  },
  { _id: false }
)

const orderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      validate: [(v) => Array.isArray(v) && v.length > 0, 'Order must have at least one item'],
    },
    status: {
      type: String,
      enum: [
        'Placed',
        'Preparing',
        'Ready',
        'Out for Delivery',
        'Delivered',
        'cancelled',
      ],
      default: 'Placed',
    },
    deliveryAddress: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, trim: true },
      city: { type: String, required: true, trim: true },
      region: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      /** Delivery drop-off as GeoJSON Point [lng, lat] — optional but useful for drivers */
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
    driverLocation: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
      },
    },
    subtotalCents: { type: Number, required: true, min: 0 },
    deliveryFeeCents: { type: Number, required: true, min: 0 },
    taxCents: { type: Number, min: 0, default: 0 },
    tipCents: { type: Number, min: 0, default: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    /** Set when integrating Stripe or another PSP */
    paymentIntentId: { type: String, trim: true },
    drivingDistanceMeters: { type: Number, min: 0 },
    ratingStars: { type: Number, min: 1, max: 5 },
    ratingComment: { type: String, trim: true, maxlength: 500 },
    ratedAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  {
    timestamps: true,
  }
)

orderSchema.index({ createdAt: -1 })
orderSchema.index({ customer: 1, createdAt: -1 })
orderSchema.index({ paymentIntentId: 1 }, { unique: true, sparse: true })

export default mongoose.models.Order ?? mongoose.model('Order', orderSchema)
