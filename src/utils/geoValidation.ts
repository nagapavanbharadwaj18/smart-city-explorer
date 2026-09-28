import { Destination, TripConstraints } from '../types';
import { detectCityFromLocation } from '../data/locationSuggestions';

/**
 * Calculates Haversine distance in kilometers between two geo-coordinates.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

export interface OriginContext {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
  city?: string;
}

export interface GeoValidationResult {
  isValid: boolean;
  distanceKm?: number;
  reason?: string;
}

/**
 * Geographically validates a destination candidate strictly against the selected starting coordinates.
 * Rejects if:
 *  - Coordinates are missing or invalid (NaN).
 *  - Origin coordinates are missing or invalid.
 *  - Distance exceeds the configured search radius (e.g. 15 km).
 *  - City / state / region conflicts with the selected starting location.
 */
export function validateRecommendationGeographically(
  dest: Destination,
  origin: OriginContext,
  maxRadiusKm = 15
): GeoValidationResult {
  // 1. Validate Origin Coordinates
  if (
    origin.latitude === undefined ||
    origin.longitude === undefined ||
    isNaN(origin.latitude) ||
    isNaN(origin.longitude)
  ) {
    return {
      isValid: false,
      reason: 'Starting location coordinates are missing or cannot be verified.',
    };
  }

  // 2. Validate Destination Coordinates
  if (
    dest.latitude === undefined ||
    dest.longitude === undefined ||
    isNaN(dest.latitude) ||
    isNaN(dest.longitude)
  ) {
    return {
      isValid: false,
      reason: `Coordinates for "${dest.name}" are missing or unverified.`,
    };
  }

  // 3. Compute Precise Haversine Distance
  const distanceKm = calculateHaversineDistanceKm(
    origin.latitude,
    origin.longitude,
    dest.latitude,
    dest.longitude
  );

  // 4. Enforce strict search radius boundary
  if (distanceKm > maxRadiusKm) {
    return {
      isValid: false,
      distanceKm,
      reason: `Destination "${dest.name}" is ${distanceKm.toFixed(1)} km away, exceeding search radius of ${maxRadiusKm} km.`,
    };
  }

  // 5. Regional / City Conflict Cross-Check
  const originText = `${origin.name || ''} ${origin.address || ''} ${origin.city || ''}`.toLowerCase();
  const destText = `${dest.name || ''} ${dest.address || ''} ${dest.description || ''}`.toLowerCase();

  const originCity = (origin.city || detectCityFromLocation(originText)).toLowerCase();
  const destCity = detectCityFromLocation(destText).toLowerCase();

  // Known city conflict pairs (cross-state / cross-region protection)
  const isOriginVijayawada = originText.includes('vijayawada') || originCity === 'vijayawada' || originText.includes('andhra');
  const isDestKanchipuram = destText.includes('kanchipuram') || destText.includes('kanchi') || destText.includes('tamil nadu');

  if (isOriginVijayawada && isDestKanchipuram) {
    return {
      isValid: false,
      distanceKm,
      reason: `Cross-city conflict: "${dest.name}" is in Kanchipuram / Tamil Nadu, while start is in Vijayawada.`,
    };
  }

  const isOriginKanchipuram = originText.includes('kanchipuram') || originCity === 'kanchipuram' || originText.includes('tamil nadu');
  const isDestVijayawada = destText.includes('vijayawada') || destText.includes('guntur') || destText.includes('andhra');

  if (isOriginKanchipuram && isDestVijayawada) {
    return {
      isValid: false,
      distanceKm,
      reason: `Cross-city conflict: "${dest.name}" is in Vijayawada / Andhra Pradesh, while start is in Kanchipuram.`,
    };
  }

  // General city conflict check: if both cities are identified and distinct, and distance is suspicious (> 30km)
  if (originCity && destCity && originCity !== destCity && distanceKm > 30) {
    return {
      isValid: false,
      distanceKm,
      reason: `City conflict: "${dest.name}" is in ${destCity}, while starting location is in ${originCity}.`,
    };
  }

  return {
    isValid: true,
    distanceKm,
  };
}

/**
 * Filters and validates recommendations strictly against origin coordinates.
 * Returns only destinations that pass all geographic checks, tagged with accurate distanceKm.
 */
export function filterValidRecommendations(
  destinations: Destination[],
  origin: OriginContext,
  maxRadiusKm = 15
): Destination[] {
  const verified: Destination[] = [];

  for (const dest of destinations) {
    const result = validateRecommendationGeographically(dest, origin, maxRadiusKm);
    if (result.isValid && result.distanceKm !== undefined) {
      verified.push({
        ...dest,
        distanceKm: Number(result.distanceKm.toFixed(2)),
      });
    } else {
      console.log(`[GEO REJECTED] ${dest.name} -> ${result.reason}`);
    }
  }

  // Sort strictly by distance from start coordinates
  verified.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  return verified;
}

/**
 * Checks whether a destination is geographically compatible with the trip's starting coordinates.
 * Used across itinerary and feasibility views (allowing up to maxRadiusKm, typically 40-50 km for a day trip).
 */
export function isDestinationGeographicallyCompatible(
  dest: Destination,
  startLocation: string,
  maxRadiusKm = 50,
  startCoordinates?: { latitude: number; longitude: number }
): { isCompatible: boolean; reason?: string } {
  if (!startCoordinates?.latitude || !startCoordinates?.longitude) {
    return {
      isCompatible: false,
      reason: 'Starting location coordinates are missing. Please select a verified start point.',
    };
  }

  const result = validateRecommendationGeographically(
    dest,
    {
      latitude: startCoordinates.latitude,
      longitude: startCoordinates.longitude,
      name: startLocation,
    },
    maxRadiusKm
  );

  return {
    isCompatible: result.isValid,
    reason: result.reason,
  };
}

/**
 * Filters a list of destinations, rejecting any that are outside the trip's geographic area.
 */
export function filterDestinationsByTripArea(
  destinations: Destination[],
  startLocation: string,
  startCoordinates?: { latitude: number; longitude: number }
): { valid: Destination[]; rejected: Destination[] } {
  const valid: Destination[] = [];
  const rejected: Destination[] = [];

  for (const dest of destinations) {
    const check = isDestinationGeographicallyCompatible(dest, startLocation, 50, startCoordinates);
    if (check.isCompatible) {
      valid.push(dest);
    } else {
      rejected.push(dest);
    }
  }

  return { valid, rejected };
}
