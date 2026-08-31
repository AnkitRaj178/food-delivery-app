import mongoose from 'mongoose'
import { isCdnImageUrl } from '../utils/imageCdn.js'

/** GeoJSON Point for 2dsphere queries — coordinates are [longitude, latitude] */

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    priceCents: { type: Number, required: true, min: 0 },
    imageUrl: {
      type: String,
      trim: true,
      validate: {
        validator(v) {
          return !v || isCdnImageUrl(v)
        },
        message: 'menu item imageUrl must point to an approved image CDN host',
      },
    },
    isAvailable: { type: Boolean, default: true },
  },
  { _id: true }
)

const restaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    logoImageUrl: {
      type: String,
      trim: true,
      validate: {
        validator(v) {
          return !v || isCdnImageUrl(v)
        },
        message: 'logoImageUrl must point to an approved image CDN host',
      },
    },
    coverImageUrl: {
      type: String,
      trim: true,
      validate: {
        validator(v) {
          return !v || isCdnImageUrl(v)
        },
        message: 'coverImageUrl must point to an approved image CDN host',
      },
    },
    cuisineTags: [{ type: String, trim: true }],
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator(v) {
            return (
              Array.isArray(v) &&
              v.length === 2 &&
              typeof v[0] === 'number' &&
              typeof v[1] === 'number' &&
              v[0] >= -180 &&
              v[0] <= 180 &&
              v[1] >= -90 &&
              v[1] <= 90
            )
          },
          message:
            'coordinates must be [longitude, latitude] with valid lng/lat ranges',
        },
      },
    },
    addressLine1: { type: String, trim: true },
    city: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    deliveryFeeCents: { type: Number, min: 0, default: 0 },
    minOrderCents: { type: Number, min: 0, default: 0 },
    /** Base kitchen preparation time in minutes before the driver leaves */
    basePrepTime: { type: Number, min: 1, default: 15 },
    /** Aggregate star rating (0 = unrated) */
    rating: { type: Number, min: 0, max: 5, default: 0 },
    /** Number of individual ratings that make up `rating` */
    ratingCount: { type: Number, min: 0, default: 0 },
    menuItems: { type: [menuItemSchema], default: [] },
  },
  {
    timestamps: true,
  }
)

restaurantSchema.index({ location: '2dsphere' })

export default mongoose.models.Restaurant ??
  mongoose.model('Restaurant', restaurantSchema)
