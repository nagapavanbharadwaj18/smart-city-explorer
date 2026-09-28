import { Destination, DestinationCategory, TripConstraints } from '../types';
import { normalizeCategory } from '../feasibility';
import { inferVisitDurationFromSignals } from '../utils/visitDuration';
import { calculateHaversineDistanceKm, validateRecommendationGeographically } from '../utils/geoValidation';
import {
  rankDestinationsByRelevance,
  evaluateDestinationCandidate,
  classifyDistanceBand,
  DEFAULT_RANKING_WEIGHTS,
  parseAvailableMinutes,
  MAJOR_VISITOR_TYPES,
  DE_PRIORITIZED_TYPES,
  DE_PRIORITIZED_KEYWORDS,
  LANDMARK_KEYWORDS,
} from './recommendationRanking';
import { MOCK_DESTINATIONS } from '../data/mockData';
export { geocodeLocationName } from '../data/locationSuggestions';

export interface SearchPlacesQuery {
  query?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  radiusMeters?: number;
  category?: string;
  limit?: number;
}

export interface PlaceSearchResult {
  id: string;
  name: string;
  formattedAddress?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  rating?: number;
  userRatingsTotal?: number;
  types?: string[];
  photoUrls?: string[];
}

/**
 * Valid Table A types for Google Places API (New) Search Nearby.
 */
export const NEARBY_TABLE_A_TYPES: Record<string, string[]> = {
  all: [
    'tourist_attraction',
    'historical_landmark',
    'hindu_temple',
    'church',
    'mosque',
    'museum',
    'art_gallery',
    'park',
    'national_park',
    'monument',
    'amusement_park',
    'zoo',
    'aquarium',
  ],
  Nature: ['park', 'national_park', 'tourist_attraction'],
  History: ['historical_landmark', 'monument', 'museum'],
  Culture: ['hindu_temple', 'museum', 'art_gallery', 'church', 'mosque', 'synagogue'],
  'Scenic places': ['park', 'national_park', 'tourist_attraction', 'monument'],
  Food: ['restaurant', 'cafe', 'bakery'],
  Shopping: ['shopping_mall', 'market'],
  Entertainment: ['amusement_park', 'zoo', 'aquarium'],
};

/**
 * Returns a distinctive fallback image according to place category
 * when a Google Places API photo is unavailable.
 */
export function getCategoryPlaceholder(category: DestinationCategory): string {
  switch (category) {
    case 'temple':
      return 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80';
    case 'museum':
      return 'https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?auto=format&fit=crop&w=800&q=80';
    case 'park':
      return 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=800&q=80';
    case 'viewpoint':
      return 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80';
    case 'historical':
      return 'https://images.unsplash.com/photo-1599831104321-499388c3a266?auto=format&fit=crop&w=800&q=80';
    case 'food':
      return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80';
    case 'shopping':
      return 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=800&q=80';
    case 'entertainment':
      return 'https://images.unsplash.com/photo-1513889961551-628c1e5e2ee9?auto=format&fit=crop&w=800&q=80';
    case 'landmark':
    default:
      return 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?auto=format&fit=crop&w=800&q=80';
  }
}

/**
 * Searches places strictly nearby a specific geographic coordinate using Google Places API (New) searchNearby.
 */
export async function searchNearbyPlaces(params: {
  location: { latitude: number; longitude: number };
  radiusMeters: number;
  category?: string;
  limit?: number;
  rankPreference?: 'POPULARITY' | 'DISTANCE';
  includedTypes?: string[];
}): Promise<PlaceSearchResult[]> {
  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      : '') ||
    (typeof process !== 'undefined' && process.env
      ? process.env.VITE_GOOGLE_MAPS_API_KEY
      : '') ||
    '';

  if (!apiKey) {
    throw new Error('Google Maps API key is missing. Please set VITE_GOOGLE_MAPS_API_KEY.');
  }

  const categoryKey = params.category && NEARBY_TABLE_A_TYPES[params.category]
    ? params.category
    : 'all';
  const includedTypes = params.includedTypes || NEARBY_TABLE_A_TYPES[categoryKey] || NEARBY_TABLE_A_TYPES.all;
  const rankPreference = params.rankPreference || 'POPULARITY';

  const requestBody: Record<string, unknown> = {
    includedTypes,
    maxResultCount: Math.min(params.limit || 20, 20),
    locationRestriction: {
      circle: {
        center: {
          latitude: params.location.latitude,
          longitude: params.location.longitude,
        },
        radius: Math.min(params.radiusMeters, 15000), // Enforce max 15km
      },
    },
    rankPreference,
  };

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.photos,places.rating,places.userRatingCount,places.types',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`Google Places searchNearby error (${response.status}): ${errorBody}`);
      return [];
    }

    const data = await response.json();
    if (!data.places || !Array.isArray(data.places)) {
      return [];
    }

    return data.places.map((place: {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      photos?: Array<{ name?: string }>;
      rating?: number;
      userRatingCount?: number;
      types?: string[];
    }): PlaceSearchResult => {
      const photoUrls =
        place.photos && place.photos.length > 0 && apiKey
          ? place.photos
              .slice(0, 3)
              .map(
                (p) =>
                  `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${apiKey}`
              )
          : [];

      return {
        id: place.id || `place-${Math.random().toString(36).substr(2, 9)}`,
        name: place.displayName?.text || '',
        formattedAddress: place.formattedAddress,
        location:
          place.location?.latitude !== undefined && place.location?.longitude !== undefined
            ? {
                latitude: place.location.latitude,
                longitude: place.location.longitude,
              }
            : undefined,
        rating: place.rating,
        userRatingsTotal: place.userRatingCount,
        types: place.types,
        photoUrls,
      };
    });
  } catch (err) {
    console.warn('searchNearbyPlaces failed:', err);
    return [];
  }
}

/**
 * Searches places using Google Places API (New) Text Search with strict geographic bounds.
 */
export async function searchPlaces(
  params: SearchPlacesQuery | string
): Promise<PlaceSearchResult[]> {
  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      : '') ||
    (typeof process !== 'undefined' && process.env
      ? process.env.VITE_GOOGLE_MAPS_API_KEY
      : '') ||
    '';

  if (!apiKey) {
    throw new Error('Google Maps API key is missing. Please set VITE_GOOGLE_MAPS_API_KEY.');
  }

  const queryText = typeof params === 'string' ? params : params.query || '';
  if (!queryText.trim()) {
    return [];
  }

  const requestBody: Record<string, unknown> = {
    textQuery: queryText.trim(),
    pageSize: 20,
  };

  let centerLat: number | undefined;
  let centerLng: number | undefined;
  let radiusMeters = 10000; // Default 10 km radius for text search

  if (typeof params !== 'string') {
    if (params.location && params.location.latitude && params.location.longitude) {
      centerLat = params.location.latitude;
      centerLng = params.location.longitude;
    }
    if (params.radiusMeters) {
      radiusMeters = Math.min(params.radiusMeters, 15000);
    }
    if (params.limit) {
      requestBody.pageSize = Math.min(Math.max(params.limit, 1), 20);
    }
  }

  if (centerLat !== undefined && centerLng !== undefined) {
    requestBody.locationRestriction = {
      circle: {
        center: {
          latitude: centerLat,
          longitude: centerLng,
        },
        radius: radiusMeters,
      },
    };
  }

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.photos,places.rating,places.userRatingCount,places.types',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`Google Places API error (${response.status}): ${errorBody}`);
      return [];
    }

    const data = await response.json();
    if (!data.places || !Array.isArray(data.places)) {
      return [];
    }

    const results = data.places.map((place: {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      photos?: Array<{ name?: string }>;
      rating?: number;
      userRatingCount?: number;
      types?: string[];
    }): PlaceSearchResult => {
      const photoUrls =
        place.photos && place.photos.length > 0 && apiKey
          ? place.photos
              .slice(0, 3)
              .map(
                (p) =>
                  `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=800&key=${apiKey}`
              )
          : [];

      return {
        id: place.id || `place-${Math.random().toString(36).substr(2, 9)}`,
        name: place.displayName?.text || '',
        formattedAddress: place.formattedAddress,
        location:
          place.location?.latitude !== undefined && place.location?.longitude !== undefined
            ? {
                latitude: place.location.latitude,
                longitude: place.location.longitude,
              }
            : undefined,
        rating: place.rating,
        userRatingsTotal: place.userRatingCount,
        types: place.types,
        photoUrls,
      };
    });

    // If center was provided, sort by distance from origin
    if (centerLat !== undefined && centerLng !== undefined) {
      results.sort((a: PlaceSearchResult, b: PlaceSearchResult) => {
        const distA =
          a.location
            ? calculateHaversineDistanceKm(centerLat!, centerLng!, a.location.latitude, a.location.longitude)
            : 999;
        const distB =
          b.location
            ? calculateHaversineDistanceKm(centerLat!, centerLng!, b.location.latitude, b.location.longitude)
            : 999;
        return distA - distB;
      });
    }

    return results;
  } catch (err) {
    console.warn('searchPlaces failed:', err);
    return [];
  }
}

/**
 * Maps Google Places API types or place name to our DestinationCategory.
 */
export function mapGoogleTypesToCategory(types?: string[], name?: string): DestinationCategory {
  if (types && types.length > 0) {
    const typeSet = new Set(types.map((t) => t.toLowerCase()));

    if (
      typeSet.has('hindu_temple') ||
      typeSet.has('place_of_worship') ||
      typeSet.has('church') ||
      typeSet.has('mosque') ||
      typeSet.has('synagogue') ||
      typeSet.has('shrine') ||
      types.some((t) => t.toLowerCase().includes('temple'))
    ) {
      return 'temple';
    }

    if (
      typeSet.has('museum') ||
      typeSet.has('art_gallery') ||
      typeSet.has('cultural_center') ||
      types.some((t) => t.toLowerCase().includes('museum'))
    ) {
      return 'museum';
    }

    if (
      typeSet.has('park') ||
      typeSet.has('national_park') ||
      typeSet.has('garden') ||
      typeSet.has('botanical_garden') ||
      typeSet.has('nature_reserve') ||
      types.some((t) => t.toLowerCase().includes('park') || t.toLowerCase().includes('garden'))
    ) {
      return 'park';
    }

    if (
      typeSet.has('tourist_attraction') ||
      typeSet.has('historical_landmark') ||
      typeSet.has('monument') ||
      typeSet.has('archaeological_site') ||
      typeSet.has('castle') ||
      typeSet.has('fortress') ||
      types.some(
        (t) =>
          t.toLowerCase().includes('historic') ||
          t.toLowerCase().includes('monument') ||
          t.toLowerCase().includes('cave') ||
          t.toLowerCase().includes('fort')
      )
    ) {
      return 'historical';
    }

    if (
      typeSet.has('scenic_viewpoint') ||
      typeSet.has('observation_deck') ||
      types.some((t) => t.toLowerCase().includes('view') || t.toLowerCase().includes('scenic'))
    ) {
      return 'viewpoint';
    }

    if (
      typeSet.has('shopping_mall') ||
      typeSet.has('market') ||
      typeSet.has('supermarket') ||
      typeSet.has('department_store') ||
      typeSet.has('store') ||
      types.some((t) => t.toLowerCase().includes('shop') || t.toLowerCase().includes('market'))
    ) {
      return 'shopping';
    }

    if (
      typeSet.has('restaurant') ||
      typeSet.has('cafe') ||
      typeSet.has('bakery') ||
      typeSet.has('bar') ||
      typeSet.has('meal_takeaway') ||
      typeSet.has('food') ||
      types.some(
        (t) =>
          t.toLowerCase().includes('food') ||
          t.toLowerCase().includes('restaurant') ||
          t.toLowerCase().includes('cafe')
      )
    ) {
      return 'food';
    }

    if (
      typeSet.has('amusement_park') ||
      typeSet.has('zoo') ||
      typeSet.has('aquarium') ||
      typeSet.has('movie_theater') ||
      typeSet.has('bowling_alley') ||
      typeSet.has('casino') ||
      types.some((t) => t.toLowerCase().includes('entertain') || t.toLowerCase().includes('theme_park'))
    ) {
      return 'entertainment';
    }

    if (
      typeSet.has('landmark') ||
      typeSet.has('bridge') ||
      typeSet.has('memorial') ||
      typeSet.has('town_square') ||
      types.some(
        (t) =>
          t.toLowerCase().includes('landmark') ||
          t.toLowerCase().includes('bridge') ||
          t.toLowerCase().includes('memorial')
      )
    ) {
      return 'landmark';
    }
  }

  return normalizeCategory(name);
}

/**
 * Converts a Google Places API (New) result into the project's Destination type
 * using its actual photo URL, exact coordinates, and category metadata.
 */
export function normalizePlaceToDestination(
  place: PlaceSearchResult,
  originCoords?: { latitude: number; longitude: number }
): Destination {
  const category = mapGoogleTypesToCategory(place.types, place.name);
  const estimatedDuration = inferVisitDurationFromSignals({
    name: place.name,
    category,
    types: place.types,
    formattedAddress: place.formattedAddress,
  });

  let distanceKm = 0;
  if (
    originCoords?.latitude !== undefined &&
    originCoords?.longitude !== undefined &&
    place.location?.latitude !== undefined &&
    place.location?.longitude !== undefined
  ) {
    distanceKm = calculateHaversineDistanceKm(
      originCoords.latitude,
      originCoords.longitude,
      place.location.latitude,
      place.location.longitude
    );
  }

  const imageUrl =
    place.photoUrls && place.photoUrls.length > 0
      ? place.photoUrls[0]
      : getCategoryPlaceholder(category);

  return {
    id: place.id,
    name: place.name,
    category,
    description: place.formattedAddress
      ? `${place.name} located at ${place.formattedAddress}`
      : `${place.name} (${category.charAt(0).toUpperCase() + category.slice(1)})`,
    image: imageUrl,
    estimatedVisitMinutes: estimatedDuration,
    visitDuration: estimatedDuration,
    visitDurationMinutes: estimatedDuration,
    distanceKm: Number(distanceKm.toFixed(2)),
    entryCost: 0,
    tags: [
      category.charAt(0).toUpperCase() + category.slice(1),
      ...(place.types?.slice(0, 3).map((t) => t.replace(/_/g, ' ')) ?? []),
    ],
    coordinates: { x: 50, y: 50 },
    highlights: [place.name],
    address: place.formattedAddress,
    latitude: place.location?.latitude,
    longitude: place.location?.longitude,
    rating: place.rating,
    userRatingsTotal: place.userRatingsTotal,
    feeUnknown: true,
    isFeeUnknown: true,
  };
}

/**
 * Progressive nearby recommendation search using a balanced relevance model:
 * 1. Geographic proximity
 * 2. Tourist/landmark importance
 * 3. Popularity/prominence (user rating count & rating)
 * 4. Place category relevance
 * 5. Suitability for user's available time
 * 6. Suitability for user's budget
 *
 * Expands search area reasonably (Immediate area -> Short trip -> Wider local area)
 * only when insufficient prominent attractions are found.
 * Never jumps to a huge radius or modifies origin coordinates.
 */
export async function fetchNearbyRecommendationsWithExpansion(
  origin: {
    name: string;
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
  },
  category?: string,
  minTargetCount = 6,
  constraints?: TripConstraints
): Promise<Destination[]> {
  if (
    origin.latitude === undefined ||
    origin.longitude === undefined ||
    isNaN(origin.latitude) ||
    isNaN(origin.longitude)
  ) {
    console.warn('[NEARBY SEARCH REJECTED] Missing or invalid origin coordinates:', origin);
    return [];
  }

  // 1. Time-Awareness: bound search radius according to available time
  const availableMinutes = parseAvailableMinutes(constraints);
  let maxExpansionRadiusKm = 15.0; // Hard bounded to city/local area (max 15km)
  if (availableMinutes <= 90) {
    // Limited free time (<= 1.5 hours): tighter search so travel doesn't consume the trip
    maxExpansionRadiusKm = 6.0;
  } else if (availableMinutes <= 180) {
    // Moderate time (1.5 to 3 hours): allow short excursions
    maxExpansionRadiusKm = 10.0;
  } else {
    // Ample time (3+ hours): allow wider local exploration
    maxExpansionRadiusKm = 15.0;
  }

  const searchRadiusMeters = Math.min(15000, Math.round(maxExpansionRadiusKm * 1000));
  const candidatePool = new Map<string, { dest: Destination; rawTypes?: string[] }>();

  console.log(
    `[RECOMMENDATION CANDIDATE SEARCH]\nOrigin: ${origin.name} (${origin.latitude}, ${origin.longitude})\nMax Radius: ${maxExpansionRadiusKm} km | Available time: ${availableMinutes} min\n`
  );

  // 2. Build Candidate Pool from the surrounding local area:
  // Query 1: Prominent / Popular attractions across the reachable local area
  const popularPlacesPromise = searchNearbyPlaces({
    location: { latitude: origin.latitude, longitude: origin.longitude },
    radiusMeters: searchRadiusMeters,
    category,
    limit: 20,
    rankPreference: 'POPULARITY',
  });

  // Query 2: Immediate proximity candidates (walkable / short ride)
  const proximityPlacesPromise = searchNearbyPlaces({
    location: { latitude: origin.latitude, longitude: origin.longitude },
    radiusMeters: Math.min(3000, searchRadiusMeters),
    category,
    limit: 15,
    rankPreference: 'DISTANCE',
  });

  // Query 3: Targeted text search for major tourist sights and landmarks in the local circle
  const textQuery = category && category !== 'All'
    ? `${category} attractions`
    : 'top tourist attractions landmarks';
  const textQueryPromise = searchPlaces({
    query: textQuery,
    location: { latitude: origin.latitude, longitude: origin.longitude },
    radiusMeters: searchRadiusMeters,
    limit: 20,
  });

  const [popularPlaces, proximityPlaces, textPlaces] = await Promise.all([
    popularPlacesPromise.catch(() => []),
    proximityPlacesPromise.catch(() => []),
    textQueryPromise.catch(() => []),
  ]);

  const combinedBatch = [...popularPlaces, ...proximityPlaces, ...textPlaces];

  for (const p of combinedBatch) {
    if (!p.location || p.location.latitude === undefined || p.location.longitude === undefined) {
      continue;
    }

    if (candidatePool.has(p.id)) {
      continue;
    }

    const dest = normalizePlaceToDestination(p, {
      latitude: origin.latitude,
      longitude: origin.longitude,
    });

    // Strict Geographic Validation against starting coordinates and city bounds
    const validation = validateRecommendationGeographically(
      dest,
      {
        latitude: origin.latitude,
        longitude: origin.longitude,
        name: origin.name,
        address: origin.address,
        city: origin.city,
      },
      maxExpansionRadiusKm
    );

    if (!validation.isValid) {
      continue;
    }

    dest.distanceKm = Number((validation.distanceKm ?? 0).toFixed(2));

    // Filter out non-tourist local services (schools, utility shops, clinics, offices, lodging)
    const nameLower = (dest.name || '').toLowerCase();
    const isDeprioritizedName = DE_PRIORITIZED_KEYWORDS.some((kw) => nameLower.includes(kw));
    const hasDeprioritizedType = (p.types || []).some((t) => DE_PRIORITIZED_TYPES.has(t.toLowerCase()));
    const hasMajorVisitorType = (p.types || []).some((t) => MAJOR_VISITOR_TYPES.has(t.toLowerCase()));
    const isLandmarkName = LANDMARK_KEYWORDS.some((kw) => nameLower.includes(kw));
    const reviewCount = p.userRatingsTotal || 0;

    // Strongly reject irrelevant establishments lacking major visitor credentials
    if (hasDeprioritizedType && !hasMajorVisitorType && !isLandmarkName) {
      continue;
    }
    if (isDeprioritizedName && reviewCount < 300) {
      continue;
    }

    candidatePool.set(dest.id, { dest, rawTypes: p.types });
  }

  let finalCandidates: Destination[] = Array.from(candidatePool.values()).map((c) => c.dest);

  // Fallback to mock destinations if Google Places API returned no results (e.g. offline/quota)
  if (finalCandidates.length === 0) {
    const validMock = MOCK_DESTINATIONS.filter((mock) => {
      const check = validateRecommendationGeographically(
        mock,
        {
          latitude: origin.latitude,
          longitude: origin.longitude,
          name: origin.name,
          address: origin.address,
          city: origin.city,
        },
        maxExpansionRadiusKm
      );
      if (check.isValid && check.distanceKm !== undefined) {
        mock.distanceKm = Number(check.distanceKm.toFixed(2));
        return true;
      }
      return false;
    });
    finalCandidates = validMock;
  }

  // 3. Rank candidate pool using the 6-factor Balanced Relevance Model
  const rankedDestinations = rankDestinationsByRelevance(finalCandidates, constraints);

  console.log(
    `[RECOMMENDATIONS RANKED] Top ${rankedDestinations.length} places around ${origin.name}:\n` +
      rankedDestinations
        .slice(0, 8)
        .map(
          (d, idx) =>
            `#${idx + 1} ${d.name} (${d.distanceKm} km, ${d.distanceBand}) -> Score: ${d.relevanceScore}/100 [Imp:${d.scoreBreakdown?.touristImportance}, Pop:${d.scoreBreakdown?.popularity}, Prox:${d.scoreBreakdown?.proximity}]`
        )
        .join('\n')
  );

  return rankedDestinations;
}

/**
 * Validates and filters candidate places against origin location boundaries,
 * and ranks them using the balanced relevance model rather than distance alone.
 */
export function validateAndLogRecommendations(
  candidates: PlaceSearchResult[],
  origin: {
    name: string;
    latitude?: number;
    longitude?: number;
    address?: string;
    city?: string;
  },
  maxRadiusKm = 15,
  constraints?: TripConstraints
): Destination[] {
  if (
    origin.latitude === undefined ||
    origin.longitude === undefined ||
    isNaN(origin.latitude) ||
    isNaN(origin.longitude)
  ) {
    return [];
  }

  const validDestinations: Destination[] = [];

  for (const place of candidates) {
    if (!place.location || place.location.latitude === undefined || place.location.longitude === undefined) {
      continue;
    }

    const dest = normalizePlaceToDestination(place, {
      latitude: origin.latitude,
      longitude: origin.longitude,
    });

    const validation = validateRecommendationGeographically(
      dest,
      {
        latitude: origin.latitude,
        longitude: origin.longitude,
        name: origin.name,
        address: origin.address,
        city: origin.city,
      },
      maxRadiusKm
    );

    if (!validation.isValid) {
      continue;
    }

    dest.distanceKm = Number((validation.distanceKm ?? 0).toFixed(2));

    // Filter out de-prioritized non-tourist establishments
    const nameLower = (dest.name || '').toLowerCase();
    const isDeprioritizedName = DE_PRIORITIZED_KEYWORDS.some((kw) => nameLower.includes(kw));
    const hasDeprioritizedType = (place.types || []).some((t) => DE_PRIORITIZED_TYPES.has(t.toLowerCase()));
    const hasMajorVisitorType = (place.types || []).some((t) => MAJOR_VISITOR_TYPES.has(t.toLowerCase()));
    const isLandmarkName = LANDMARK_KEYWORDS.some((kw) => nameLower.includes(kw));
    const reviewCount = place.userRatingsTotal || 0;

    if (hasDeprioritizedType && !hasMajorVisitorType && !isLandmarkName) {
      continue;
    }
    if (isDeprioritizedName && reviewCount < 300) {
      continue;
    }

    validDestinations.push(dest);
  }

  // Rank using the balanced relevance model
  return rankDestinationsByRelevance(validDestinations, constraints);
}
