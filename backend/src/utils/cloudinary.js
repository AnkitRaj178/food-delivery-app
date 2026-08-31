import { v2 as cloudinary } from 'cloudinary'
import { assertCdnImageUrl } from './imageCdn.js'

function configured() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  return Boolean(cloudName && apiKey && apiSecret)
}

function configureClient() {
  if (!configured()) {
    throw Object.assign(
      new Error('Cloudinary credentials missing: CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET'),
      { status: 500 }
    )
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  })
}

/**
 * Uploads an image payload to Cloudinary and returns CDN metadata.
 * Accepts Buffer, data URL, or remote URL supported by Cloudinary.
 */
export async function uploadImageToCloudinary(file, options = {}) {
  configureClient()

  const result = await cloudinary.uploader.upload(file, {
    folder: options.folder ?? 'food-delivery',
    public_id: options.publicId,
    overwrite: options.overwrite ?? false,
    resource_type: 'image',
    transformation: options.transformation ?? [{ quality: 'auto', fetch_format: 'auto' }],
  })

  assertCdnImageUrl(result.secure_url, 'cloudinary secure_url')

  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  }
}
