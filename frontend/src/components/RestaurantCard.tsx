import { Link } from 'react-router-dom'
import type { RestaurantDto } from '../lib/api'

type RestaurantCardProps = {
  restaurant: RestaurantDto
  distanceKm: number | null
}

/** Formats rating + count into a compact badge string */
function RatingBadge({ rating, count }: { rating: number; count: number }) {
  if (rating === 0 || count === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        ⭐ New
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
      ⭐ {rating.toFixed(1)}
      <span className="text-amber-500/80">({count})</span>
    </span>
  )
}

export default function RestaurantCard({ restaurant, distanceKm }: RestaurantCardProps) {
  const imageUrl =
    restaurant.coverImageUrl ??
    restaurant.logoImageUrl ??
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/sample.jpg'

  return (
    <Link
      to={`/restaurants/${restaurant.slug ?? restaurant.id}`}
      className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100">
        <img
          src={imageUrl}
          alt={restaurant.name}
          loading="lazy"
          className="h-full w-full object-cover transition group-hover:scale-[1.02]"
        />
      </div>
      <div className="p-4">
        {/* Name row */}
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-1 text-base font-semibold text-slate-900">{restaurant.name}</h3>
          {/* ETA badge — top-right */}
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
            {restaurant.etaMinutes} min
          </span>
        </div>

        {/* Description */}
        {restaurant.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{restaurant.description}</p>
        ) : null}

        {/* Rating + cuisine tags row */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <RatingBadge rating={restaurant.rating} count={restaurant.ratingCount} />
          {restaurant.cuisineTags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
              {tag}
            </span>
          ))}
        </div>

        {/* Footer meta — bullet-separated single line */}
        <p className="mt-3 text-xs text-slate-500">
          {distanceKm != null ? <>{distanceKm.toFixed(1)} km<span className="mx-1.5 text-slate-300">•</span></> : null}
          Delivery ${(restaurant.deliveryFeeCents / 100).toFixed(2)}
          <span className="mx-1.5 text-slate-300">•</span>
          Min ${(restaurant.minOrderCents / 100).toFixed(2)}
        </p>
      </div>
    </Link>
  )
}
