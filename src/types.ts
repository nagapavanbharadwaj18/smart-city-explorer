export type PlanningMode = 'manual' | 'ai_suggest';

export type TransportMode =
  | 'walking'
  | 'two_wheeler'
  | 'driving'
  | 'public_transport'
  | 'auto_cab'
  | 'bike_rental'
  | 'bicycle'
  | 'system_choice'
  | 'metro'
  | 'bus';

export type PacePreference = 'relaxed' | 'balanced' | 'packed';

export type DestinationCategory =
  | 'temple'
  | 'historical'
  | 'museum'
  | 'park'
  | 'viewpoint'
  | 'shopping'
  | 'food'
  | 'entertainment'
  | 'landmark'
  | 'other';

export interface RentalPickupShop {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  estimatedTravelMinutes?: number;
  estimatedTravelTimeFormatted?: string;
  rating?: number;
  userRatingsTotal?: number;
  phoneNumber?: string;
  website?: string;
  openNow?: boolean;
  openingStatusText?: string;
  regularOpeningHours?: string[];
  rentalPriceInfo?: string;
}

export interface TripCoordinates {
  latitude: number;
  longitude: number;
}

export interface StartLocationInfo {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  placeId: string;
  city?: string;
}

export interface TripConstraints {
  startLocation: string;
  returnLocation: string;
  sameReturnLocation: boolean;
  startTime: string; // e.g. "13:00"
  endTime: string;   // e.g. "17:00"
  returnDeadline: string; // e.g. "17:30"
  budget: number; // e.g. 500
  currency: string; // e.g. "₹"
  peopleCount: number;
  transportPreference: TransportMode;
  interests: string[];
  pacePreference: PacePreference;
  rentalPickupShop?: RentalPickupShop;
  segmentTransportModes?: Record<string, TransportMode>;
  wantsRentedBike?: boolean;
  startCoordinates?: TripCoordinates;
  returnCoordinates?: TripCoordinates;
  startLocationInfo?: StartLocationInfo;
  isCurrentLocation?: boolean;
  locationAccuracy?: number;
  locationWarning?: string;
}

export interface Destination {
  id: string;
  name: string;
  category: DestinationCategory;
  description: string;
  image: string;
  estimatedVisitMinutes?: number; // Destination-specific estimated visit duration in minutes
  userVisitMinutes?: number; // User-customized planned visit duration in minutes
  visitDuration?: number; // Explicit planning visit duration in minutes
  visitDurationMinutes: number; // Active visit duration in minutes (userVisitMinutes ?? estimatedVisitMinutes)
  distanceKm: number;
  entryCost: number; // per person
  tags: string[];
  matchReason?: string;
  coordinates: { x: number; y: number }; // normalized 0-100 on city map
  highlights: string[];
  openingHours?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  userRatingsTotal?: number;
  feeUnknown?: boolean;
  isFeeUnknown?: boolean;
  distanceBand?: 'VERY_NEAR' | 'NEAR' | 'SHORT_TRIP' | 'WIDER_LOCAL_AREA';
  relevanceScore?: number;
  scoreBreakdown?: {
    proximity: number;
    touristImportance: number;
    popularity: number;
    categoryRelevance: number;
    timeSuitability: number;
    budgetSuitability: number;
  };
}

export interface BikeRentalOption {
  id: string;
  name: string;
  distanceKm: number;
  hourlyRate: number;
  locationName: string;
  operatingHours: string;
  contactNote: string;
}

export interface VerificationCheck {
  id: string;
  label: string;
  status: 'passed' | 'warning' | 'failed' | 'pending';
  detail: string;
  metric?: string;
}

export interface RouteSegment {
  id: string;
  type: 'start' | 'visit' | 'travel' | 'break' | 'return';
  title: string;
  subtitle?: string;
  time: string;
  durationMinutes: number;
  distanceKm?: number;
  cost: number;
  transportMode?: TransportMode;
  destinationId?: string;
  iconType?: string;
  // Visit duration and stop breakdown metadata
  category?: DestinationCategory;
  travelMinutes?: number;
  visitDurationMinutes?: number;
  totalStopMinutes?: number;
  arrivalTime?: string;
  departureTime?: string;
  isEstimated?: boolean;
  isRealRoute?: boolean;
  isFallback?: boolean;
  routeLabel?: string;
  transitDetails?: any[];
  // Transportation fare metadata
  fareDisplay?: string;
  fareCertainty?: 'exact' | 'estimated' | 'unavailable';
  isFareUnknown?: boolean;
  fareMin?: number;
  fareMax?: number;
  fareSourceLabel?: string;
}

export interface ExcludedDestination {
  destination: Destination;
  reason: string;
  category: 'deadline_exceeded' | 'budget_exceeded' | 'time_window_exceeded' | 'buffer_depleted';
  impact: {
    timeNeededMinutes: number;
    additionalCost: number;
    projectedReturnTime: string;
  };
}

export interface FeasibleAlternativePlan {
  destinations: Destination[];
  timeUsedMinutes: number;
  totalCost: number;
  expectedReturnTime: string;
  bufferMinutes: number;
  savedMinutes: number;
  totalTravelTime: number;
  totalVisitTime: number;
  remainingBudget: number;
  remainingTime: number;
}

export interface FeasibilityResult {
  // Primary Feasibility flag (both names supported)
  feasible: boolean;
  isFeasible: boolean;

  // Destinations breakdown
  selectedDestinations: Destination[];
  includedDestinations: Destination[];
  excludedDestinations: ExcludedDestination[];

  // Duration & Time
  totalDistanceKm?: number;
  travelTime?: number;
  totalTravelTime: number;
  totalVisitTime: number;
  totalDuration: number;
  totalTripTime?: number;
  returnTravelTime?: number;
  timeUsedMinutes: number;
  timeAvailableMinutes: number;
  remainingTime: number;
  additionalTimeRequiredMinutes?: number;
  isTimeExceeded?: boolean;

  // Cost & Budget
  estimatedCost: number;
  totalCost: number;
  totalTransportCost?: number;
  totalEntryCost?: number;
  overBudgetAmount?: number;
  isBudgetExceeded?: boolean;
  transportCostFormatted?: string;
  hasUnknownFares?: boolean;
  unknownFaresCount?: number;
  isBudgetUncertain?: boolean;
  budget: number;
  remainingBudget: number;

  // Deadlines & Buffers
  startTimeFormatted?: string;
  departureTime?: string;
  expectedReturnTime: string;
  returnDeadline: string;
  deadlineTime: string;
  safetyBuffer: number;
  bufferMinutes: number;

  // Diagnostic explanations & Feasibility Statuses
  timeStatusMessage?: string;
  budgetStatusMessage?: string;
  feasibilityVerdictMessage?: string;
  failedConstraintExplanation?: string;
  reasons: string[];
  failureReasons: string[];
  primaryFailureCategory?: 'insufficient_time' | 'deadline_exceeded' | 'budget_exceeded' | 'multiple_constraints_failed';
  checks: VerificationCheck[];

  // Subsets Alternative Plan
  alternativePlan?: FeasibleAlternativePlan;

  // Itinerary timeline
  timeline: RouteSegment[];
}

export type AppScreen =
  | 'landing'
  | 'mode_select'
  | 'trip_details'
  | 'destination_select'
  | 'ai_recommend'
  | 'transport_select'
  | 'feasibility'
  | 'itinerary';
