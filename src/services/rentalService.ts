/**
 * Service for discovering legitimate nearby bike / two-wheeler rental businesses
 * strictly around the user's selected STARTING LOCATION (within approx. 2 km).
 */

export interface RentalBusiness {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  estimatedTravelMinutes: number;
  estimatedTravelTimeFormatted: string;
  rating?: number;
  userRatingsTotal?: number;
  phoneNumber?: string;
  website?: string;
  openNow?: boolean;
  openingStatusText?: string;
  regularOpeningHours?: string[];
  rentalPriceInfo?: string;
}

export interface StartingLocationPoint {
  latitude: number;
  longitude: number;
  name?: string;
  formattedAddress?: string;
}

/**
 * Calculates Haversine distance in kilometers between two geo-coordinates.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Identifies whether a Google Places candidate is a legitimate rental business.
 * Generic matching only: strictly avoids hardcoding any specific company, city, or shop.
 * Strictly excludes vehicle repair shops, dealerships, parking, and random automobile stores.
 */
export function isLegitimateRentalBusiness(name: string, types: string[] = []): boolean {
  const n = name.toLowerCase();
  const t = types.map((s) => s.toLowerCase());

  // Explicit generic positive indicators in business name
  const positiveTerms = [
    'rental',
    'rentals',
    'rent a bike',
    'bike rent',
    'scooter rent',
    'motorcycle rent',
    'bicycle rent',
    'two wheeler for rent',
    'two-wheeler for rent',
    'self drive',
    'self-drive',
    'bike hire',
    'scooter hire',
    'bicycle hire',
    'vehicle hire',
    'bike sharing',
    'scooter sharing',
    'vehicle rental',
    'motorcycle hire',
    'renting',
  ];

  const hasPositiveName = positiveTerms.some((term) => n.includes(term));
  const hasPositiveType =
    t.includes('car_rental') ||
    t.includes('bicycle_rental') ||
    t.includes('vehicle_rental');

  if (hasPositiveName || hasPositiveType) {
    return true;
  }

  // Strictly filter out non-rental businesses
  const negativeTerms = [
    'showroom',
    'dealership',
    'dealer',
    'repair',
    'service center',
    'spare parts',
    'parking',
    'mechanic',
    'used bikes',
    'second hand',
    'puncture',
    'gas station',
    'car wash',
  ];

  if (negativeTerms.some((term) => n.includes(term))) {
    return false;
  }

  return false;
}

// In-memory cache for resolved start location coordinates
const startLocationGeoCache = new Map<string, StartingLocationPoint | null>();

/**
 * Resolves latitude and longitude coordinates for a given starting location string.
 * Strictly derives coordinates from the user's starting location query.
 * NEVER falls back to Vijayawada or hardcoded defaults.
 */
export async function resolveStartingLocation(
  startLocation: string
): Promise<StartingLocationPoint | null> {
  const query = startLocation.trim();
  if (!query) {
    return null;
  }

  const cacheKey = query.toLowerCase();
  if (startLocationGeoCache.has(cacheKey)) {
    return startLocationGeoCache.get(cacheKey) || null;
  }

  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) ||
    (typeof process !== 'undefined' &&
      (process.env?.VITE_GOOGLE_MAPS_API_KEY || process.env?.GOOGLE_MAPS_API_KEY)) ||
    '';

  if (!apiKey) {
    console.warn('VITE_GOOGLE_MAPS_API_KEY is not configured; cannot geocode starting location.');
    return null;
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        textQuery: query,
      }),
    });

    if (!res.ok) {
      console.warn(`Geocoding starting location failed with status: ${res.status}`);
      startLocationGeoCache.set(cacheKey, null);
      return null;
    }

    const data = await res.json();
    const place = data.places?.[0];

    if (!place?.location?.latitude || !place?.location?.longitude) {
      startLocationGeoCache.set(cacheKey, null);
      return null;
    }

    const point: StartingLocationPoint = {
      latitude: place.location.latitude,
      longitude: place.location.longitude,
      name: place.displayName?.text || query,
      formattedAddress: place.formattedAddress,
    };

    startLocationGeoCache.set(cacheKey, point);
    return point;
  } catch (err) {
    console.warn('Error resolving starting location coordinates:', err);
    return null;
  }
}

// In-memory cache for rental business queries
const rentalSearchCache = new Map<string, RentalBusiness[]>();

/**
 * Searches for legitimate bike/two-wheeler rental businesses around the user's
 * STARTING LOCATION within approximately 2000 meters (2 km).
 *
 * Requirements:
 * - If no starting location is provided, does NOT search and returns [].
 * - Search center MUST be startingLocation.latitude + startingLocation.longitude.
 * - Does NOT search around destinations, city centers, or device location.
 * - Strictly filters out repair shops, dealerships, parking, and non-rental shops.
 * - Results are sorted ascending by distance from starting location.
 */
export async function findNearbyBikeRentals(
  startLocation: string,
  options?: {
    coordinates?: { latitude: number; longitude: number };
    radiusMeters?: number;
    signal?: AbortSignal;
  }
): Promise<{
  businesses: RentalBusiness[];
  center: StartingLocationPoint | null;
  searched: boolean;
}> {
  const query = startLocation.trim();

  // Rule 7: If the user has NOT selected a starting location, DO NOT search.
  if (!query) {
    return {
      businesses: [],
      center: null,
      searched: false,
    };
  }

  // 1. Resolve starting location coordinates
  let center: StartingLocationPoint | null = null;
  if (options?.coordinates) {
    center = {
      latitude: options.coordinates.latitude,
      longitude: options.coordinates.longitude,
      name: query,
    };
  } else {
    center = await resolveStartingLocation(query);
  }

  if (!center) {
    return {
      businesses: [],
      center: null,
      searched: true,
    };
  }

  const radiusMeters = options?.radiusMeters ?? 5000;
  const radiusKm = radiusMeters / 1000;

  const cacheKey = `${center.latitude.toFixed(5)},${center.longitude.toFixed(5)}@${radiusMeters}`;
  if (rentalSearchCache.has(cacheKey)) {
    return {
      businesses: rentalSearchCache.get(cacheKey) || [],
      center,
      searched: true,
    };
  }

  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) ||
    (typeof process !== 'undefined' &&
      (process.env?.VITE_GOOGLE_MAPS_API_KEY || process.env?.GOOGLE_MAPS_API_KEY)) ||
    '';

  if (!apiKey) {
    return {
      businesses: [],
      center,
      searched: true,
    };
  }

  // Approximate degree bounding box for the search area
  const deltaLat = radiusMeters / 111000;
  const deltaLng = radiusMeters / (111000 * Math.cos((center.latitude * Math.PI) / 180));

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.nationalPhoneNumber,places.websiteUri,places.currentOpeningHours,places.regularOpeningHours',
      },
      body: JSON.stringify({
        textQuery: 'bike rental OR motorcycle rental OR scooter rental OR two wheeler rental',
        locationRestriction: {
          rectangle: {
            low: {
              latitude: center.latitude - deltaLat,
              longitude: center.longitude - deltaLng,
            },
            high: {
              latitude: center.latitude + deltaLat,
              longitude: center.longitude + deltaLng,
            },
          },
        },
      }),
    });

    if (!res.ok) {
      console.warn(`Places API search failed with status: ${res.status}`);
      return {
        businesses: [],
        center,
        searched: true,
      };
    }

    const data = await res.json();
    const places = data.places || [];

    const businesses: RentalBusiness[] = [];

    for (const place of places) {
      const name = place.displayName?.text || '';
      if (!name) continue;

      // Filter: must be identified as a legitimate rental business
      if (!isLegitimateRentalBusiness(name, place.types || [])) {
        continue;
      }

      if (
        place.location?.latitude === undefined ||
        place.location?.longitude === undefined
      ) {
        continue;
      }

      // Exact Haversine distance from the starting location
      const distanceKm = calculateDistanceKm(
        center.latitude,
        center.longitude,
        place.location.latitude,
        place.location.longitude
      );

      // Prefer businesses close to the start, but include suitable shops in the sensible search area (up to 5-6 km)
      if (distanceKm <= radiusKm + 0.5) {
        // Calculate estimated travel time: walking for <=1.2km, quick transit/cab for >1.2km
        const estimatedTravelMinutes =
          distanceKm <= 1.2
            ? Math.max(2, Math.round((distanceKm / 4.5) * 60))
            : Math.max(4, Math.round((distanceKm / 22) * 60 + 3));
        const estimatedTravelTimeFormatted = `~${estimatedTravelMinutes} min travel`;

        const openNow = place.currentOpeningHours?.openNow;
        const openingStatusText =
          typeof openNow === 'boolean'
            ? openNow
              ? 'Open now'
              : 'Closed'
            : undefined;
        const regularOpeningHours = place.regularOpeningHours?.weekdayDescriptions;

        businesses.push({
          placeId: place.id || `rental-${businesses.length}`,
          name,
          address: place.formattedAddress || 'Address unavailable',
          latitude: place.location.latitude,
          longitude: place.location.longitude,
          distanceKm,
          estimatedTravelMinutes,
          estimatedTravelTimeFormatted,
          rating: place.rating,
          userRatingsTotal: place.userRatingCount,
          phoneNumber: place.nationalPhoneNumber,
          website: place.websiteUri,
          openNow,
          openingStatusText,
          regularOpeningHours,
          rentalPriceInfo: 'Rental price unavailable — check with the business.',
        });
      }
    }

    // Sort results ascending by distance from starting location
    businesses.sort((a, b) => a.distanceKm - b.distanceKm);

    rentalSearchCache.set(cacheKey, businesses);

    return {
      businesses,
      center,
      searched: true,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { businesses: [], center, searched: false };
    }
    console.warn('Error querying nearby bike rental businesses:', err);
    return {
      businesses: [],
      center,
      searched: true,
    };
  }
}
