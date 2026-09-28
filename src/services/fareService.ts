import { TransportMode, Destination } from '../types';

export type FareCertainty = 'exact' | 'estimated' | 'unavailable';

export interface FareEstimate {
  certainty: FareCertainty;
  minAmount?: number;
  maxAmount?: number;
  amount?: number; // Representative/median value for budgeting when known or estimated
  currency: string;
  formattedFare: string; // e.g. "₹90–₹130", "₹0", "Fare estimate unavailable"
  label: string; // e.g. "Estimated two-wheeler fare: ₹90–₹130", "Fare: ₹0 (Free)", "Fare estimate unavailable"
  sourceDescription: string;
  isUnknown: boolean;
  rentalVehicleFare?: {
    certainty: FareCertainty;
    amount?: number;
    formattedFare: string;
    label: string;
    sourceDescription: string;
    isUnknown: boolean;
  };
}

export interface SegmentFareEstimate {
  segmentId: string;
  fromName: string;
  toName: string;
  mode: TransportMode;
  distanceKm: number;
  durationMinutes: number;
  fare: FareEstimate;
}

export interface JourneyFareSummary {
  segmentFares: SegmentFareEstimate[];
  totalMinCost: number;
  totalMaxCost: number;
  totalCost: number; // Representative total for budgeting
  formattedDisplay: string;
  hasUnknownFares: boolean;
  unknownFaresCount: number;
  certainty: FareCertainty;
}

export interface SegmentFareOptions {
  peopleCount?: number;
  currency?: string;
  transitDetails?: any[];
  isRental?: boolean;
  rentalShop?: {
    placeId?: string;
    name?: string;
    hourlyRate?: number;
    dailyRate?: number;
    pricingSource?: string;
  };
}

/**
 * Rounds to nearest multiple of step (e.g. 5 or 10)
 */
function roundToStep(value: number, step = 5): number {
  return Math.round(value / step) * step;
}

/**
 * 1. Walking: Always exact ₹0
 */
export function estimateWalkingFare(currency = '₹'): FareEstimate {
  return {
    certainty: 'exact',
    minAmount: 0,
    maxAmount: 0,
    amount: 0,
    currency,
    formattedFare: `${currency}0`,
    label: `Fare: ${currency}0 (Free)`,
    sourceDescription: 'Free self-mobility (Walking)',
    isUnknown: false,
  };
}

/**
 * 2. Bicycle: ₹0 for owned bicycle; separate rental check if rental
 */
export function estimateBicycleFare(
  isRental = false,
  rentalShop?: { name?: string; hourlyRate?: number; dailyRate?: number; pricingSource?: string },
  durationHours = 1,
  currency = '₹'
): FareEstimate {
  if (!isRental) {
    return {
      certainty: 'exact',
      minAmount: 0,
      maxAmount: 0,
      amount: 0,
      currency,
      formattedFare: `${currency}0`,
      label: `Fare: ${currency}0 (Own bicycle)`,
      sourceDescription: 'Own bicycle (No rental fee)',
      isUnknown: false,
    };
  }

  // If rental requested, do NOT invent pricing
  if (rentalShop?.hourlyRate && rentalShop.hourlyRate > 0) {
    const cost = Math.ceil(durationHours) * rentalShop.hourlyRate;
    return {
      certainty: 'exact',
      minAmount: cost,
      maxAmount: cost,
      amount: cost,
      currency,
      formattedFare: `${currency}${cost}`,
      label: `Rental fee: ${currency}${cost} (${rentalShop.pricingSource || rentalShop.name})`,
      sourceDescription: `Verified rate from ${rentalShop.name}`,
      isUnknown: false,
    };
  }

  return {
    certainty: 'unavailable',
    currency,
    formattedFare: 'Rental price unavailable — check with the business.',
    label: 'Rental price unavailable — check with the business.',
    sourceDescription: 'Rental price unavailable — check with the business.',
    isUnknown: true,
  };
}

/**
 * 3. Two-Wheeler / Motorcycle / Scooter:
 * Clearly labeled estimated range based on route distance and travel duration.
 * Strictly NEVER claimed as an official/live Rapido or Ola fare.
 */
export function estimateTwoWheelerSegmentFare(
  distanceKm: number,
  durationMinutes = 0,
  currency = '₹'
): FareEstimate {
  if (distanceKm <= 0) {
    return {
      certainty: 'exact',
      minAmount: 0,
      maxAmount: 0,
      amount: 0,
      currency,
      formattedFare: `${currency}0`,
      label: `Fare: ${currency}0`,
      sourceDescription: 'Zero distance segment',
      isUnknown: false,
    };
  }

  const validDist = Math.max(0.5, distanceKm);
  const timeFactor = durationMinutes > 0 ? durationMinutes * 0.6 : validDist * 1.5;

  const rawLow = 25 + validDist * 8.5 + timeFactor * 0.3;
  const rawHigh = 35 + validDist * 12.5 + timeFactor * 0.8;

  const minAmount = Math.max(25, roundToStep(rawLow, 5));
  const maxAmount = Math.max(minAmount + 15, roundToStep(rawHigh, 5));
  const amount = Math.round((minAmount + maxAmount) / 2);

  return {
    certainty: 'estimated',
    minAmount,
    maxAmount,
    amount,
    currency,
    formattedFare: `~${currency}${minAmount}–${currency}${maxAmount}`,
    label: `Estimated two-wheeler fare: ~${currency}${minAmount}–${currency}${maxAmount} (Check provider app for live fare)`,
    sourceDescription: 'Distance and duration based estimate (Check Rapido/Ola app for live fare)',
    isUnknown: false,
  };
}

/**
 * 3b. Personal Driving:
 * Estimated fuel and running cost (~₹8–₹12/km)
 */
export function estimatePersonalDrivingFare(
  distanceKm: number,
  durationMinutes = 0,
  currency = '₹'
): FareEstimate {
  if (distanceKm <= 0) {
    return {
      certainty: 'exact',
      minAmount: 0,
      maxAmount: 0,
      amount: 0,
      currency,
      formattedFare: `${currency}0`,
      label: `Fare: ${currency}0`,
      sourceDescription: 'Zero distance segment',
      isUnknown: false,
    };
  }

  const validDist = Math.max(0.5, distanceKm);
  const minAmount = Math.max(15, roundToStep(validDist * 8, 5));
  const maxAmount = Math.max(minAmount + 10, roundToStep(validDist * 12 + 10, 5));
  const amount = Math.round((minAmount + maxAmount) / 2);

  return {
    certainty: 'estimated',
    minAmount,
    maxAmount,
    amount,
    currency,
    formattedFare: `~${currency}${minAmount}–${currency}${maxAmount}`,
    label: `Estimated driving fuel/running cost: ~${currency}${minAmount}–${currency}${maxAmount}`,
    sourceDescription: 'Estimated personal driving fuel cost (~₹8–₹12/km)',
    isUnknown: false,
  };
}

/**
 * 4. Cab / Auto / Taxi / Ride-hailing:
 * Clearly labeled estimated range based on route distance and travel duration.
 * Strictly NEVER claimed as an official/live Uber or Ola fare.
 */
export function estimateCabSegmentFare(
  distanceKm: number,
  durationMinutes = 0,
  peopleCount = 1,
  currency = '₹'
): FareEstimate {
  if (distanceKm <= 0) {
    return {
      certainty: 'exact',
      minAmount: 0,
      maxAmount: 0,
      amount: 0,
      currency,
      formattedFare: `${currency}0`,
      label: `Fare: ${currency}0`,
      sourceDescription: 'Zero distance segment',
      isUnknown: false,
    };
  }

  const validDist = Math.max(0.8, distanceKm);
  const timeFactor = durationMinutes > 0 ? durationMinutes * 1.2 : validDist * 2.5;

  // Shared across vehicle capacity (up to 4 people)
  const rawLow = 50 + validDist * 14 + timeFactor * 0.5;
  const rawHigh = 75 + validDist * 21 + timeFactor * 1.0;

  const minAmount = Math.max(50, roundToStep(rawLow, 10));
  const maxAmount = Math.max(minAmount + 25, roundToStep(rawHigh, 10));
  const amount = Math.round((minAmount + maxAmount) / 2);

  return {
    certainty: 'estimated',
    minAmount,
    maxAmount,
    amount,
    currency,
    formattedFare: `~${currency}${minAmount}–${currency}${maxAmount}`,
    label: `Ride-hailing estimate: ~${currency}${minAmount}–${currency}${maxAmount} (Check Uber/Ola/Auto for live fare)`,
    sourceDescription: 'Approximate estimate (Check Uber/Ola/Rapido for live fare & surge)',
    isUnknown: false,
  };
}

/**
 * 5. Metro:
 * Distance-based fare bands when transit route/distance is available.
 * Displays "Fare estimate unavailable" when reliable info is missing.
 */
export function estimateMetroSegmentFare(
  distanceKm: number,
  transitDetails?: any[],
  peopleCount = 1,
  currency = '₹'
): FareEstimate {
  if (distanceKm <= 0) {
    return {
      certainty: 'unavailable',
      currency,
      formattedFare: 'Fare estimate unavailable',
      label: 'Fare estimate unavailable',
      sourceDescription: 'No route distance available for metro line',
      isUnknown: true,
    };
  }

  // Distance stage fare bands per passenger
  let perPersonMin = 20;
  let perPersonMax = 30;

  if (distanceKm <= 3) {
    perPersonMin = 15;
    perPersonMax = 25;
  } else if (distanceKm <= 8) {
    perPersonMin = 25;
    perPersonMax = 35;
  } else if (distanceKm <= 15) {
    perPersonMin = 35;
    perPersonMax = 50;
  } else {
    perPersonMin = 45;
    perPersonMax = 65;
  }

  const count = Math.max(1, peopleCount);
  const minAmount = perPersonMin * count;
  const maxAmount = perPersonMax * count;
  const amount = Math.round((minAmount + maxAmount) / 2);

  return {
    certainty: 'estimated',
    minAmount,
    maxAmount,
    amount,
    currency,
    formattedFare: `${currency}${minAmount}–${currency}${maxAmount}`,
    label: `Estimated metro fare: ${currency}${minAmount}–${currency}${maxAmount}`,
    sourceDescription: `Metro network distance stage estimate (${count} passenger${count > 1 ? 's' : ''})`,
    isUnknown: false,
  };
}

/**
 * 6. City Bus:
 * Distance-based fare bands when route is available.
 * Displays "Fare estimate unavailable" when reliable info is missing.
 */
export function estimateBusSegmentFare(
  distanceKm: number,
  transitDetails?: any[],
  peopleCount = 1,
  currency = '₹'
): FareEstimate {
  if (distanceKm <= 0) {
    return {
      certainty: 'unavailable',
      currency,
      formattedFare: 'Fare estimate unavailable',
      label: 'Fare estimate unavailable',
      sourceDescription: 'No route distance available for bus line',
      isUnknown: true,
    };
  }

  let perPersonMin = 15;
  let perPersonMax = 25;

  if (distanceKm <= 4) {
    perPersonMin = 10;
    perPersonMax = 20;
  } else if (distanceKm <= 10) {
    perPersonMin = 20;
    perPersonMax = 30;
  } else if (distanceKm <= 18) {
    perPersonMin = 30;
    perPersonMax = 45;
  } else {
    perPersonMin = 40;
    perPersonMax = 55;
  }

  const count = Math.max(1, peopleCount);
  const minAmount = perPersonMin * count;
  const maxAmount = perPersonMax * count;
  const amount = Math.round((minAmount + maxAmount) / 2);

  return {
    certainty: 'estimated',
    minAmount,
    maxAmount,
    amount,
    currency,
    formattedFare: `${currency}${minAmount}–${currency}${maxAmount}`,
    label: `Estimated bus fare: ${currency}${minAmount}–${currency}${maxAmount}`,
    sourceDescription: `City bus stage estimate (${count} passenger${count > 1 ? 's' : ''})`,
    isUnknown: false,
  };
}

/**
 * General Segment Fare Estimator:
 * Routes to the appropriate mode handler with complete error and uncertainty guards.
 */
export function estimateSegmentFare(
  mode: TransportMode,
  distanceKm: number,
  durationMinutes = 0,
  options: SegmentFareOptions = {}
): FareEstimate {
  const currency = options.currency || '₹';
  const peopleCount = options.peopleCount || 1;

  switch (mode) {
    case 'walking':
      return estimateWalkingFare(currency);

    case 'bicycle':
      return estimateBicycleFare(false, undefined, 1, currency);

    case 'bike_rental':
      return estimateBicycleFare(true, options.rentalShop, 1, currency);

    case 'two_wheeler':
      return estimateTwoWheelerSegmentFare(distanceKm, durationMinutes, currency);

    case 'driving':
      return estimatePersonalDrivingFare(distanceKm, durationMinutes, currency);

    case 'auto_cab':
      return estimateCabSegmentFare(distanceKm, durationMinutes, peopleCount, currency);

    case 'metro':
      return estimateMetroSegmentFare(distanceKm, options.transitDetails, peopleCount, currency);

    case 'bus':
      return estimateBusSegmentFare(distanceKm, options.transitDetails, peopleCount, currency);

    case 'public_transport': {
      // Check if subway/metro or bus
      const details = options.transitDetails || [];
      const hasSubway = details.some(
        (t: any) => t.vehicleType === 'SUBWAY' || t.vehicleType === 'METRO_RAIL'
      );
      if (hasSubway) {
        return estimateMetroSegmentFare(distanceKm, details, peopleCount, currency);
      }
      return estimateBusSegmentFare(distanceKm, details, peopleCount, currency);
    }

    case 'system_choice':
    default:
      // Sensible auto/cab fallback for system choice when mode not resolved
      return estimateCabSegmentFare(distanceKm, durationMinutes, peopleCount, currency);
  }
}

/**
 * Computes the total journey transportation fare across multiple sequential segments.
 */
export function calculateTotalJourneyFare(
  segments: Array<{
    id?: string;
    fromName?: string;
    toName?: string;
    mode: TransportMode;
    distanceKm: number;
    durationMinutes?: number;
    transitDetails?: any[];
  }>,
  options: SegmentFareOptions = {}
): JourneyFareSummary {
  const currency = options.currency || '₹';
  const segmentFares: SegmentFareEstimate[] = [];

  let totalMinCost = 0;
  let totalMaxCost = 0;
  let totalCost = 0;
  let hasUnknownFares = false;
  let unknownFaresCount = 0;
  let allExact = true;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const fare = estimateSegmentFare(seg.mode, seg.distanceKm, seg.durationMinutes || 0, {
      ...options,
      transitDetails: seg.transitDetails,
    });

    segmentFares.push({
      segmentId: seg.id || `seg-${i}`,
      fromName: seg.fromName || `Stop ${i}`,
      toName: seg.toName || `Stop ${i + 1}`,
      mode: seg.mode,
      distanceKm: seg.distanceKm,
      durationMinutes: seg.durationMinutes || 0,
      fare,
    });

    if (fare.isUnknown || fare.certainty === 'unavailable') {
      hasUnknownFares = true;
      unknownFaresCount++;
      allExact = false;
    } else {
      totalMinCost += fare.minAmount ?? 0;
      totalMaxCost += fare.maxAmount ?? (fare.amount ?? 0);
      totalCost += fare.amount ?? 0;
      if (fare.certainty !== 'exact') {
        allExact = false;
      }
    }
  }

  let formattedDisplay = '';
  if (hasUnknownFares && totalCost === 0) {
    formattedDisplay = 'Fare estimate unavailable';
  } else if (hasUnknownFares) {
    formattedDisplay = `${currency}${totalMinCost}–${currency}${totalMaxCost} + unknown fares`;
  } else if (allExact && totalCost === 0) {
    formattedDisplay = `${currency}0 (Free)`;
  } else if (allExact) {
    formattedDisplay = `${currency}${totalCost}`;
  } else {
    formattedDisplay = `${currency}${totalMinCost}–${currency}${totalMaxCost}`;
  }

  const certainty: FareCertainty = hasUnknownFares
    ? 'unavailable'
    : allExact
    ? 'exact'
    : 'estimated';

  return {
    segmentFares,
    totalMinCost,
    totalMaxCost,
    totalCost,
    formattedDisplay,
    hasUnknownFares,
    unknownFaresCount,
    certainty,
  };
}
