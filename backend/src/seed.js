import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Restaurant from './models/Restaurant.js'
import { connectDB } from './config/db.js'

dotenv.config()

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Returns a random float in [min, max] rounded to `decimals` places */
function randFloat(min, max, decimals = 1) {
  const val = Math.random() * (max - min) + min
  return parseFloat(val.toFixed(decimals))
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)]
}

/**
 * Approximate small random offsets (in degrees) for nearby points.
 * - ~0.01 deg latitude ≈ 1.11km
 * - longitude degrees shrink by cos(latitude)
 */
function offsetCoordinates([lng, lat], radiusKm = 4) {
  const maxLatDelta = radiusKm / 111
  const maxLngDelta = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)))
  const latDelta = (Math.random() * 2 - 1) * maxLatDelta
  const lngDelta = (Math.random() * 2 - 1) * maxLngDelta
  return [Number((lng + lngDelta).toFixed(6)), Number((lat + latDelta).toFixed(6))]
}

function unsplash(photoId, extra = '') {
  // Must remain on images.unsplash.com to satisfy backend validation.
  const base = `https://images.unsplash.com/${photoId}`
  const params = new URLSearchParams({
    auto: 'format',
    fit: 'crop',
    q: '70',
    ...Object.fromEntries(new URLSearchParams(extra)),
  })
  return `${base}?${params.toString()}`
}

function makeMenuForCuisine(cuisine) {
  const menus = {
    'North Indian': [
      [
        'Butter Chicken',
        'Creamy tomato gravy, kasuri methi, and charred chicken pieces',
        34900,
        'photo-1604908176997-125f25cc500f',
      ],
      [
        'Dal Makhani',
        'Slow-cooked black lentils finished with butter and cream',
        22900,
        'photo-1601050690597-5f9c5f66b53b',
      ],
      [
        'Paneer Tikka',
        'Smoky, tandoor-roasted paneer with mint chutney',
        28900,
        'photo-1603899123205-192d2e2b44c4',
      ],
      ['Garlic Naan', 'Hand-stretched naan with roasted garlic butter', 6900, 'photo-1601050690613-5f7b74a53ce3'],
      ['Jeera Rice', 'Basmati rice tempered with cumin and ghee', 12900, 'photo-1604908176457-6c0b2a2d7fba'],
      [
        'Gulab Jamun (2 pcs)',
        'Warm milk-solid dumplings in saffron sugar syrup',
        9900,
        'photo-1601050690590-97c0f5d9b91c',
      ],
    ],
    Biryani: [
      [
        'Hyderabadi Chicken Biryani',
        'Dum-style basmati with fried onions and aromatic spices',
        32900,
        'photo-1604908177522-4029b1f2a4d4',
      ],
      [
        'Veg Dum Biryani',
        'Vegetables, saffron rice, and whole spices slow-cooked together',
        26900,
        'photo-1604908177549-4d3b3f1c9c85',
      ],
      [
        'Mirchi Ka Salan',
        'Tangy peanut-sesame curry to pair with biryani',
        12900,
        'photo-1604908177079-fb585c46b59d',
      ],
      ['Raita', 'Cucumber-yogurt raita with cumin', 5900, 'photo-1604908176888-8a7c1d6a2a52'],
      ['Double Ka Meetha', 'Hyderabadi bread pudding with nuts', 10900, 'photo-1604908176575-10f6a3f3c5d7'],
    ],
    Pizza: [
      ['Margherita', 'Tomato, mozzarella, basil, and olive oil', 24900, 'photo-1548365328-9bdb1f6b8b2b'],
      ['Pepperoni', 'Crispy pepperoni, mozzarella, and oregano', 31900, 'photo-1601924579446-1f9c8b3a1f4a'],
      [
        'Spicy Paneer Tikka Pizza',
        'Tandoori paneer, onions, capsicum, and chili oil',
        33900,
        'photo-1590947132387-155cc02f3212',
      ],
      ['Garlic Breadsticks', 'Baked breadsticks with garlic butter', 14900, 'photo-1541592106381-b31e9677c0e5'],
      ['Chocolate Lava Cake', 'Warm cake with molten chocolate center', 12900, 'photo-1563805042-7684c019e1cb'],
    ],
    Burgers: [
      ['Classic Cheeseburger', 'Cheddar, pickles, onions, house sauce', 28900, 'photo-1550547660-d9450f859349'],
      ['Crispy Chicken Burger', 'Buttermilk chicken, slaw, spicy mayo', 27900, 'photo-1550317138-10000687a72b'],
      ['Paneer Crunch Burger', 'Crispy paneer, lettuce, tomato, mint mayo', 24900, 'photo-1619740455993-9c5f46f4dbe5'],
      ['Loaded Fries', 'Cheese sauce, jalapeños, paprika', 16900, 'photo-1505253216365-3c3f9aa3a1d7'],
      ['Iced Cola (330ml)', 'Chilled soft drink', 5900, 'photo-1527960471264-932f39eb5846'],
    ],
    'South Indian': [
      [
        'Masala Dosa',
        'Crisp dosa with spiced potato filling and coconut chutney',
        15900,
        'photo-1630409346699-7940e9a1a3bf',
      ],
      ['Idli (4 pcs)', 'Steamed rice cakes with sambar and chutney', 10900, 'photo-1625944525533-473f2c14a3cd'],
      ['Vada (2 pcs)', 'Crispy lentil fritters served with sambar', 9900, 'photo-1625944525572-8c4e1d2a3f5b'],
      ['Filter Coffee', 'Strong South Indian coffee with frothy milk', 7900, 'photo-1517705008128-361805f42e86'],
      [
        'Mini Tiffin',
        'Sampler: dosa, idli, vada with sambar & chutneys',
        22900,
        'photo-1630409346431-4b9b6a3e4d3a',
      ],
    ],
    Sushi: [
      ['Salmon Nigiri (6 pcs)', 'Fresh salmon over seasoned sushi rice', 49900, 'photo-1553621042-f6e147245754'],
      ['California Roll', 'Crab stick, cucumber, avocado, sesame', 37900, 'photo-1617196034183-42197e7fa05f'],
      ['Spicy Tuna Roll', 'Tuna, chili mayo, scallions', 41900, 'photo-1553621042-8e89c3a5e0f1'],
      ['Miso Soup', 'Tofu, wakame, scallions', 12900, 'photo-1540189549336-e6e99c3679fe'],
      ['Matcha Cheesecake', 'Creamy matcha dessert slice', 19900, 'photo-1551024506-0bccd828d307'],
    ],
  }

  const base = menus[cuisine] ?? menus['North Indian']
  const extras = [
    ['Mineral Water (1L)', 'Chilled packaged drinking water', 4000, 'photo-1510626176961-4b57d4fbad03'],
    ['Seasonal Salad', 'Fresh greens with citrus vinaigrette', 11900, 'photo-1512621776951-a57141f2eefd'],
    ['Chocolate Brownie', 'Fudgy brownie with cocoa nibs', 14900, 'photo-1499636136210-6f4ee915583e'],
  ]

  const items = [...base]
  while (items.length < 10) items.push(pick(extras))

  return items.slice(0, 10).map(([name, description, priceCents, photoId], idx) => ({
    name,
    description,
    priceCents,
    imageUrl: unsplash(photoId, `w=900&h=700&sig=${idx + randInt(1, 9999)}`),
    isAvailable: Math.random() > 0.06,
  }))
}

function buildRestaurantsForCity({ cityName, citySlug, center }) {
  const concepts = [
    { suffix: 'Kitchen', tags: ['North Indian', 'Biryani'] },
    { suffix: 'Biryani House', tags: ['Biryani', 'North Indian'] },
    { suffix: 'Pizzeria', tags: ['Pizza'] },
    { suffix: 'Burger Co.', tags: ['Burgers'] },
    { suffix: 'Tiffin Room', tags: ['South Indian', 'North Indian'] },
    { suffix: 'Sushi Bar', tags: ['Sushi'] },
  ]

  const nameStarters = [
    'Urban',
    'Spice Route',
    'Copper Kettle',
    'Coriander',
    'Naan & Co.',
    'Midnight',
    'Street',
    'Royal',
    'Green Bowl',
    'Ocean',
    'Charcoal',
    'Claypot',
  ]

  const coverPhotos = [
    'photo-1555939594-58d7cb561ad1',
    'photo-1414235077428-338989a2e8c0',
    'photo-1504674900247-0877df9cc836',
    'photo-1529692236671-f1f6cf9683ba',
    'photo-1540189549336-e6e99c3679fe',
  ]

  const logoPhotos = [
    'photo-1526401485004-2d9d5fce3a87',
    'photo-1528825871115-3581a5387919',
    'photo-1523293836415-1d6b259c8d25',
    'photo-1529139574466-a303027c1d8b',
    'photo-1528756514091-dee5ecaa3278',
  ]

  const restaurants = []
  const count = 10

  for (let i = 0; i < count; i++) {
    const concept = pick(concepts)
    const starter = pick(nameStarters)
    const name = `${starter} ${concept.suffix}`
    const cuisineTags = Array.from(new Set(concept.tags))
    const primaryCuisine = cuisineTags[0] ?? 'North Indian'

    const coords = offsetCoordinates(center, 5)
    const rating = randFloat(3.8, 5.0, 1)
    const ratingCount = randInt(10, 500)
    const basePrepTime = randInt(10, 25)
    const deliveryFeeCents = randInt(1900, 6900)
    const minOrderCents = randInt(14900, 29900)

    const addressVariants = [
      `Shop ${randInt(1, 220)}, Sector ${randInt(1, 168)}`,
      `Unit ${randInt(1, 99)}, Market Road`,
      `${randInt(1, 88)}-B, High Street`,
      `Plot ${randInt(1, 420)}, Food Court`,
      `Near Metro Gate ${randInt(1, 6)}`,
    ]

    restaurants.push({
      name,
      description: `A ${primaryCuisine.toLowerCase()} spot known for reliable portions, quick prep, and consistently fresh ingredients.`,
      logoImageUrl: unsplash(pick(logoPhotos), `w=256&h=256&sig=${randInt(1, 9999)}`),
      coverImageUrl: unsplash(pick(coverPhotos), `w=1600&h=900&sig=${randInt(1, 9999)}`),
      cuisineTags,
      slug: `${slugify(name)}-${citySlug}-${i + 1}`,
      location: { type: 'Point', coordinates: coords },
      addressLine1: `${pick(addressVariants)}, ${cityName}`,
      city: cityName,
      isActive: true,
      deliveryFeeCents,
      minOrderCents,
      basePrepTime,
      rating,
      ratingCount,
      menuItems: makeMenuForCuisine(primaryCuisine),
    })
  }

  return restaurants
}

async function main() {
  const demoCities = [
    { cityName: 'Greater Noida', citySlug: 'greater-noida', center: [77.5011, 28.4744] },
    { cityName: 'Pune', citySlug: 'pune', center: [73.8567, 18.5204] },
    { cityName: 'Bangalore', citySlug: 'bangalore', center: [77.5946, 12.9716] },
  ]

  await connectDB()

  // Ensure the geospatial index exists before doing $near queries.
  await Restaurant.syncIndexes()

  console.log('Clearing restaurants collection…')
  await Restaurant.deleteMany({})

  const docs = demoCities.flatMap((c) => buildRestaurantsForCity(c))

  console.log(`Inserting ${docs.length} restaurants across ${demoCities.length} demo cities…`)
  await Restaurant.insertMany(docs, { ordered: true })

  const counts = await Restaurant.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$city', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])

  console.log('Seed complete. Active restaurants by city:')
  for (const row of counts) {
    console.log(`- ${row._id}: ${row.count}`)
  }
}

main()
  .then(async () => {
    await mongoose.disconnect()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error(err)
    await mongoose.disconnect().catch(() => null)
    process.exit(1)
  })

