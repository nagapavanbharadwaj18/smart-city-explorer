import { Destination, TripConstraints } from '../types';
import { calculateHaversineDistanceKm } from '../utils/geoValidation';

export type DistanceClassification = 'VERY_NEAR' | 'NEAR' | 'SHORT_TRIP' | 'WIDER_LOCAL_AREA';

export interface ScoreBreakdown {
  proximity: number;
  touristImportance: number;
  popularity: number;
  categoryRelevance: number;
  timeSuitability: number;
  budgetSuitability: number;
}

export interface RecommendationRankingWeights {
  proximity: number;          // Geographic proximity (18%)
  touristImportance: number;  // Tourist/landmark importance (32%)
  popularity: number;         // Popularity/prominence/reviews (24%)
  categoryRelevance: number;  // Place category & interest relevance (14%)
  timeSuitability: number;    // Available time suitability (8%)
  budgetSuitability: number;  // Budget suitability (4%)
}

/**
 * Configurable weights for recommendation ranking.
 * Ensures major landmarks can rank above ordinary nearby businesses when reasonably reachable.
 */
export const DEFAULT_RANKING_WEIGHTS: RecommendationRankingWeights = {
  proximity: 0.18,
  touristImportance: 0.32,
  popularity: 0.24,
  categoryRelevance: 0.14,
  timeSuitability: 0.08,
  budgetSuitability: 0.04,
};

/**
 * Classifies a distance into one of the four required distance bands:
 * - VERY NEAR: < 2.5 km (walkable or quick local ride)
 * - NEAR: 2.5 – 6.0 km (short inner-city trip)
 * - SHORT TRIP: 6.0 – 11.0 km (moderate city excursion)
 * - WIDER LOCAL AREA: 11.0 – 16.0 km (expanded metropolitan perimeter)
 */
export function classifyDistanceBand(distanceKm: number): DistanceClassification {
  if (distanceKm < 2.5) return 'VERY_NEAR';
  if (distanceKm < 6.0) return 'NEAR';
  if (distanceKm < 11.0) return 'SHORT_TRIP';
  return 'WIDER_LOCAL_AREA';
}

export function formatDistanceClassification(band: DistanceClassification): string {
  switch (band) {
    case 'VERY_NEAR':
      return 'VERY NEAR';
    case 'NEAR':
      return 'NEAR';
    case 'SHORT_TRIP':
      return 'SHORT TRIP';
    case 'WIDER_LOCAL_AREA':
      return 'WIDER LOCAL AREA';
  }
}

/**
 * Primary Google Places types that indicate major landmarks, cultural, historical,
 * scenic, religious, or major visitor attractions.
 */
export const MAJOR_VISITOR_TYPES = new Set([
  'tourist_attraction',
  'historical_landmark',
  'monument',
  'archaeological_site',
  'world_heritage_site',
  'castle',
  'fortress',
  'hindu_temple',
  'place_of_worship',
  'church',
  'cathedral',
  'mosque',
  'synagogue',
  'shrine',
  'museum',
  'art_gallery',
  'scenic_viewpoint',
  'observation_deck',
  'national_park',
  'bridge',
  'memorial',
  'botanical_garden',
  'cultural_landmark',
]);

/**
 * Secondary recreational, scenic, and leisure types with good visitor appeal.
 */
export const RECREATIONAL_VISITOR_TYPES = new Set([
  'park',
  'botanical_garden',
  'amusement_park',
  'zoo',
  'aquarium',
  'cultural_center',
  'memorial',
  'town_square',
  'plaza',
  'beach',
  'lake',
  'river',
]);

/**
 * Types of places to de-prioritize or penalize because they lack tourist/visitor value
 * (e.g. schools, utility shops, businesses unrelated to tourism, medical clinics, offices, lodging).
 */
export const DE_PRIORITIZED_TYPES = new Set([
  'school',
  'primary_school',
  'secondary_school',
  'high_school',
  'university',
  'preschool',
  'convenience_store',
  'supermarket',
  'grocery_store',
  'department_store',
  'clothing_store',
  'shoe_store',
  'hardware_store',
  'electronics_store',
  'home_goods_store',
  'liquor_store',
  'store',
  'shopping_mall',
  'wholesaler',
  'pet_store',
  'book_store',
  'jewelry_store',
  'furniture_store',
  'cell_phone_store',
  'optician',
  'florist',
  'bank',
  'atm',
  'accounting',
  'insurance_agency',
  'real_estate_agency',
  'finance',
  'hospital',
  'doctor',
  'dentist',
  'physiotherapist',
  'pharmacy',
  'veterinary_care',
  'car_repair',
  'car_dealer',
  'car_rental',
  'gas_station',
  'parking',
  'car_wash',
  'laundry',
  'dry_cleaner',
  'electrician',
  'plumber',
  'roofing_contractor',
  'painter',
  'moving_company',
  'locksmith',
  'storage',
  'hair_care',
  'beauty_salon',
  'spa',
  'gym',
  'lawyer',
  'cemetery',
  'funeral_home',
  'lodging',
  'hotel',
  'motel',
  'hostel',
  'guest_house',
  'local_government_office',
  'courthouse',
  'embassy',
  'city_hall',
  'post_office',
  'police',
  'fire_station',
  'transit_station',
  'bus_station',
  'train_station',
  'subway_station',
]);

/**
 * Keyword patterns in place names signaling significant landmarks, monuments, and sights.
 */
export const LANDMARK_KEYWORDS = [
  'temple', 'mandir', 'kovil', 'devasthanam', 'shrine', 'basilica', 'cathedral', 'church', 'mosque', 'masjid', 'gurudwara', 'gurdwara', 'ashram', 'stupa', 'pagoda',
  'fort', 'fortress', 'palace', 'mahal', 'caves', 'cave', 'tomb', 'monument', 'memorial', 'heritage',
  'museum', 'gallery', 'planetarium',
  'barrage', 'dam', 'bridge', 'ghat', 'riverfront', 'island', 'lake', 'waterfall', 'waterfalls', 'falls',
  'park', 'garden', 'botanical', 'sanctuary', 'zoo', 'viewpoint', 'view point', 'hills', 'hill', 'valley', 'cliff', 'promenade', 'statue',
];

/**
 * Keyword patterns in place names signaling mundane commercial, administrative, or educational facilities.
 */
export const DE_PRIORITIZED_KEYWORDS = [
  'school', 'vidyalaya', 'college', 'academy', 'institute', 'coaching', 'tuition', 'classes', 'kindergarten',
  'clinic', 'hospital', 'diagnostic', 'dental', 'pharmacy', 'medical', 'chemist', 'healthcare',
  'pvt ltd', 'private limited', 'enterprises', 'traders', 'agency', 'consultancy', 'services', 'industries', 'associates',
  'xerox', 'tailor', 'salon', 'parlour', 'mechanic', 'tyres', 'workshop', 'hardware', 'opticals', 'repairs', 'service center', 'service centre',
  'auto stand', 'bus stop', 'bus stand', 'taxi stand', 'railway station',
  'store', 'shop', 'mart', 'supermarket', 'textiles', 'jewellers', 'jewellery', 'tailors', 'furnishing', 'footwear', 'apparel',
  'hotel', 'lodge', 'residency', 'rooms', 'pg', 'guest house', 'inn', 'suites', 'dormitory',
  'atm', 'bank', 'courier', 'stationery', 'printers', 'motor', 'motors', 'automobiles', 'spares',
];

/**
 * 1. Geographic Proximity Score (0 – 100)
 * Proximity is a meaningful preference, but not the only factor.
 * Uses smooth decay across distance classifications.
 */
export function calculateProximityScore(distanceKm: number): number {
  if (distanceKm <= 0.1) return 100;

  if (distanceKm <= 2.5) {
    // VERY NEAR: 88 – 100
    return Math.max(88, 100 - (distanceKm / 2.5) * 12);
  } else if (distanceKm <= 6.0) {
    // NEAR: 70 – 88
    const progress = (distanceKm - 2.5) / 3.5;
    return Math.max(70, 88 - progress * 18);
  } else if (distanceKm <= 11.0) {
    // SHORT TRIP: 45 – 70
    const progress = (distanceKm - 6.0) / 5.0;
    return Math.max(45, 70 - progress * 25);
  } else if (distanceKm <= 16.0) {
    // WIDER LOCAL AREA: 20 – 45
    const progress = (distanceKm - 11.0) / 5.0;
    return Math.max(20, 45 - progress * 25);
  } else {
    // Unreasonably far away: falls off sharply
    return Math.max(0, 20 - (distanceKm - 16.0) * 4);
  }
}

/**
 * 2. Tourist & Landmark Importance Score (0 – 100)
 * Evaluates place types, metadata, category, and name signals to detect genuine
 * tourist/visitor attractions vs ordinary local establishments.
 */
export function calculateTouristImportanceScore(
  dest: Destination,
  rawTypes?: string[]
): number {
  let score = 25; // Neutral baseline
  const nameLower = (dest.name || '').toLowerCase();
  const descLower = (dest.description || '').toLowerCase();
  const types = rawTypes || dest.tags.map((t) => t.toLowerCase().replace(/\s+/g, '_'));
  const reviewCount = dest.userRatingsTotal || 0;
  const rating = dest.rating || 0;

  // A. Check for major landmark types
  const hasMajorType = types.some((t) => MAJOR_VISITOR_TYPES.has(t.toLowerCase()));
  const hasRecreationalType = types.some((t) => RECREATIONAL_VISITOR_TYPES.has(t.toLowerCase()));
  const hasDeprioritizedType = types.some((t) => DE_PRIORITIZED_TYPES.has(t.toLowerCase()));

  // B. Major landmark name signal
  const isLandmarkName = LANDMARK_KEYWORDS.some((kw) => nameLower.includes(kw));

  // C. Deprioritized name signal
  const isDeprioritizedName = DE_PRIORITIZED_KEYWORDS.some((kw) => nameLower.includes(kw));

  // D. Type scoring with visitor validation
  if (hasMajorType) {
    if (reviewCount >= 50 || isLandmarkName) {
      score += 35;
    } else {
      score += 15; // Tiny obscure spot with major type but negligible visitor footprint
    }
  } else if (hasRecreationalType) {
    score += (reviewCount >= 50 || isLandmarkName) ? 22 : 10;
  }

  // E. Major visitor review prominence bonus: true city landmarks have high visitor volume
  if (reviewCount >= 5000) {
    score += 28;
  } else if (reviewCount >= 2000) {
    score += 22;
  } else if (reviewCount >= 500) {
    score += 16;
  } else if (reviewCount >= 100) {
    score += 10;
  } else if (reviewCount < 25 && !isLandmarkName && !hasMajorType) {
    score -= 15;
  }

  // F. Category bonus
  if (['landmark', 'historical', 'temple', 'museum', 'viewpoint'].includes(dest.category)) {
    score += 12;
  } else if (dest.category === 'park') {
    score += 8;
  }

  // G. Landmark name keyword bonus
  if (isLandmarkName && !isDeprioritizedName) {
    score += 12;
  }

  // H. Rating signal
  if (rating >= 4.4 && reviewCount >= 30) {
    score += 6;
  } else if (rating > 0 && rating < 3.6) {
    score -= 10;
  }

  // I. Heavy penalty for de-prioritized types & keywords (schools, clinics, shops, offices, hotels)
  if (hasDeprioritizedType) {
    score -= 50;
  }
  if (isDeprioritizedName) {
    score -= 50;
  }

  // J. Description signals
  if (
    descLower.includes('heritage') ||
    descLower.includes('century') ||
    descLower.includes('architectural') ||
    descLower.includes('scenic') ||
    descLower.includes('tourist') ||
    descLower.includes('landmark')
  ) {
    score += 6;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * 3. Popularity & Prominence Score (0 – 100)
 * Uses review volume combined with star rating.
 * Allows iconic landmarks with high review counts to stand out over obscure spots.
 */
export function calculatePopularityScore(dest: Destination): number {
  const reviewCount = dest.userRatingsTotal || 0;
  const rating = dest.rating || 0;

  let baseReviewScore = 15;
  if (reviewCount >= 5000) {
    baseReviewScore = 100;
  } else if (reviewCount >= 2000) {
    baseReviewScore = 90;
  } else if (reviewCount >= 1000) {
    baseReviewScore = 80;
  } else if (reviewCount >= 500) {
    baseReviewScore = 70;
  } else if (reviewCount >= 200) {
    baseReviewScore = 55;
  } else if (reviewCount >= 75) {
    baseReviewScore = 40;
  } else if (reviewCount >= 25) {
    baseReviewScore = 25;
  } else if (reviewCount > 0) {
    baseReviewScore = 15;
  }

  let ratingFactor = 1.0;
  if (rating > 0) {
    if (rating >= 4.5) ratingFactor = 1.05;
    else if (rating >= 4.2) ratingFactor = 1.0;
    else if (rating >= 3.8) ratingFactor = 0.92;
    else if (rating >= 3.2) ratingFactor = 0.8;
    else ratingFactor = 0.65;
  }

  return Math.min(100, Math.max(0, Math.round(baseReviewScore * ratingFactor)));
}

/**
 * 4. Place Category Relevance Score (0 – 100)
 * Evaluates how well the destination matches the user's selected interests
 * or primary city exploration categories.
 */
export function calculateCategoryRelevanceScore(
  dest: Destination,
  userInterests: string[] = []
): number {
  if (userInterests.length === 0) {
    // Default: major visitor categories have solid general relevance
    if (['landmark', 'historical', 'temple', 'museum', 'park', 'viewpoint'].includes(dest.category)) {
      return 85;
    }
    return 60;
  }

  const tags = dest.tags.map((t) => t.toLowerCase());
  const categoryLower = dest.category.toLowerCase();

  let matchCount = 0;
  for (const interest of userInterests) {
    const intLower = interest.toLowerCase();
    if (tags.some((t) => t.includes(intLower) || intLower.includes(t)) || categoryLower.includes(intLower)) {
      matchCount++;
    }
  }

  if (matchCount >= 2) return 100;
  if (matchCount === 1) return 88;

  // Even if no direct interest match, major landmarks maintain baseline appeal
  if (['landmark', 'historical', 'temple', 'museum', 'viewpoint'].includes(dest.category)) {
    return 68;
  }

  return 45;
}

/**
 * 5. Available Time Suitability Score (0 – 100)
 * Prioritizes places that fit comfortably into the user's available time
 * without consuming disproportionate transit time.
 */
export function calculateTimeSuitabilityScore(
  dest: Destination,
  availableMinutes: number
): number {
  const safeAvailableMinutes = Math.max(45, availableMinutes);
  // Estimate realistic round-trip travel time (city transit ~20 km/h + 5 min dispatch/waiting each way)
  const oneWayTravelMins = Math.round(dest.distanceKm * 2.8 + 6);
  const roundTripTravelMins = oneWayTravelMins * 2;
  const visitDwellMins = dest.visitDurationMinutes || dest.estimatedVisitMinutes || 45;
  const totalCommitmentMins = roundTripTravelMins + visitDwellMins;

  // A. Plentiful time available: comfortably fits
  if (totalCommitmentMins <= safeAvailableMinutes * 0.65) {
    return 100;
  }

  // B. Good fit
  if (totalCommitmentMins <= safeAvailableMinutes * 0.85) {
    return 88;
  }

  // C. Moderate fit: fits within available time
  if (totalCommitmentMins <= safeAvailableMinutes) {
    return 70;
  }

  // D. Over available time: penalize progressively so trips needing too much transit time are de-prioritized
  const excessMins = totalCommitmentMins - safeAvailableMinutes;
  return Math.max(5, Math.round(55 - excessMins * 1.2));
}

/**
 * 6. Budget Suitability Score (0 – 100)
 * Prefers attractions that fit the user's budget.
 * Strongly favors free/low-cost major attractions over expensive options.
 */
export function calculateBudgetSuitabilityScore(
  dest: Destination,
  budget: number,
  peopleCount = 1
): number {
  const safeBudget = Math.max(50, budget);
  const totalEntryCost = (dest.entryCost || 0) * Math.max(1, peopleCount);

  // Free major attraction (e.g. public barrage, riverside, temples, monuments with free entry)
  if (dest.entryCost === 0) {
    return 100;
  }

  const budgetRatio = totalEntryCost / safeBudget;

  if (budgetRatio <= 0.15) {
    return 92;
  } else if (budgetRatio <= 0.40) {
    return 78;
  } else if (budgetRatio <= 0.70) {
    return 60;
  } else if (budgetRatio <= 1.0) {
    return 42;
  } else {
    // Exceeds total budget!
    return 12;
  }
}

/**
 * Calculates user's available time in minutes from TripConstraints.
 */
export function parseAvailableMinutes(constraints?: TripConstraints): number {
  if (!constraints?.startTime || !constraints?.endTime) {
    return 240; // Default: 4 hours
  }

  const [startH, startM] = constraints.startTime.split(':').map(Number);
  const [endH, endM] = constraints.endTime.split(':').map(Number);

  const startTotal = (startH || 0) * 60 + (startM || 0);
  const endTotal = (endH || 0) * 60 + (endM || 0);

  const diff = endTotal - startTotal;
  return diff > 30 ? diff : 240;
}

/**
 * Evaluates and scores a destination candidate using the 6-factor balanced relevance model.
 */
export function evaluateDestinationCandidate(
  dest: Destination,
  constraints?: TripConstraints,
  weights: RecommendationRankingWeights = DEFAULT_RANKING_WEIGHTS,
  rawTypes?: string[]
): {
  relevanceScore: number;
  distanceBand: DistanceClassification;
  breakdown: ScoreBreakdown;
  matchReason: string;
} {
  const distanceKm = dest.distanceKm || 0;
  const distanceBand = classifyDistanceBand(distanceKm);
  const availableMinutes = parseAvailableMinutes(constraints);
  const budget = constraints?.budget ?? 500;
  const peopleCount = constraints?.peopleCount ?? 1;
  const userInterests = constraints?.interests ?? [];

  const proximity = calculateProximityScore(distanceKm);
  const touristImportance = calculateTouristImportanceScore(dest, rawTypes);
  const popularity = calculatePopularityScore(dest);
  const categoryRelevance = calculateCategoryRelevanceScore(dest, userInterests);
  const timeSuitability = calculateTimeSuitabilityScore(dest, availableMinutes);
  const budgetSuitability = calculateBudgetSuitabilityScore(dest, budget, peopleCount);

  const breakdown: ScoreBreakdown = {
    proximity,
    touristImportance,
    popularity,
    categoryRelevance,
    timeSuitability,
    budgetSuitability,
  };

  const relevanceScore = Number(
    (
      proximity * weights.proximity +
      touristImportance * weights.touristImportance +
      popularity * weights.popularity +
      categoryRelevance * weights.categoryRelevance +
      timeSuitability * weights.timeSuitability +
      budgetSuitability * weights.budgetSuitability
    ).toFixed(1)
  );

  // Generate a concise, human-friendly match reason reflecting the balanced relevance model
  let matchReason = '';
  const bandLabel = formatDistanceClassification(distanceBand);
  const reviewCount = dest.userRatingsTotal || 0;

  if (touristImportance >= 80 && reviewCount >= 1000) {
    matchReason = `Major city landmark (${bandLabel} • ${distanceKm.toFixed(1)} km) with ${reviewCount.toLocaleString()} visitor reviews and high tourist prominence`;
  } else if (touristImportance >= 75) {
    matchReason = `Top visitor sight (${bandLabel} • ${distanceKm.toFixed(1)} km) with strong cultural & historical interest`;
  } else if (popularity >= 75) {
    matchReason = `Popular local attraction (${bandLabel} • ${distanceKm.toFixed(1)} km) highly rated by visitors`;
  } else if (distanceBand === 'VERY_NEAR') {
    matchReason = `Very near your starting point (${distanceKm.toFixed(1)} km) • Quick & convenient visit`;
  } else {
    matchReason = `${dest.category.charAt(0).toUpperCase() + dest.category.slice(1)} attraction (${bandLabel} • ${distanceKm.toFixed(1)} km) suited to your constraints`;
  }

  return {
    relevanceScore,
    distanceBand,
    breakdown,
    matchReason,
  };
}

/**
 * Ranks a list of candidate destinations using the balanced relevance model.
 * Automatically classifies distance bands, computes composite scores,
 * and sorts by relevance score descending.
 */
export function rankDestinationsByRelevance(
  destinations: Destination[],
  constraints?: TripConstraints,
  weights: RecommendationRankingWeights = DEFAULT_RANKING_WEIGHTS
): Destination[] {
  const scored = destinations.map((dest) => {
    const evaluation = evaluateDestinationCandidate(dest, constraints, weights);
    return {
      ...dest,
      distanceBand: evaluation.distanceBand,
      relevanceScore: evaluation.relevanceScore,
      scoreBreakdown: evaluation.breakdown,
      matchReason: dest.matchReason && !dest.matchReason.startsWith('Nearby attraction located')
        ? dest.matchReason
        : evaluation.matchReason,
    };
  });

  // Sort by composite relevance score descending (high tourist value + reasonable distance)
  scored.sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
  return scored;
}
