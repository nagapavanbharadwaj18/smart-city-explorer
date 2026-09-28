import { Destination, DestinationCategory } from '../types';
import { normalizeCategory } from '../feasibility';

/**
 * Signal-based analysis to determine a realistic estimated visit duration in minutes
 * based on attraction characteristics (type, scope, keywords, descriptions).
 *
 * Examples:
 * - Lalbagh Botanical Garden / Sprawling Park: 90 - 120 min
 * - Historical Fort / Palace Complex / Multi-tier Caves: 60 - 90 min
 * - Small historical monument / statue / stupa / viewpoint: 20 - 30 min
 * - Museum / Art Gallery: 50 - 60 min
 * - Major hilltop temple complex: 50 - 60 min vs small local shrine: 25 - 30 min
 */
export function inferVisitDurationFromSignals(place: {
  name?: string;
  description?: string;
  category?: DestinationCategory | string;
  tags?: string[];
  highlights?: string[];
  types?: string[];
  formattedAddress?: string;
  address?: string;
}): number {
  const name = (place.name || '').toLowerCase();
  const desc = (place.description || '').toLowerCase();
  const tagsStr = (place.tags || []).join(' ').toLowerCase();
  const highlightsStr = (place.highlights || []).join(' ').toLowerCase();
  const typesStr = (place.types || []).join(' ').toLowerCase();
  const addressStr = (place.formattedAddress || place.address || '').toLowerCase();
  const combined = `${name} ${desc} ${tagsStr} ${highlightsStr} ${typesStr} ${addressStr}`;

  // 1. Sprawling nature reserves, botanical gardens, large parks, river islands, theme parks (90 - 120 mins)
  if (
    combined.includes('botanical garden') ||
    combined.includes('national park') ||
    combined.includes('wildlife sanctuary') ||
    combined.includes('river island') ||
    combined.includes('bhavani island') ||
    combined.includes('amusement park') ||
    combined.includes('water park') ||
    combined.includes('theme park') ||
    combined.includes('zoological park') ||
    combined.includes('safari')
  ) {
    if (combined.includes('botanical garden') || combined.includes('island')) {
      return 90;
    }
    return 100;
  }

  // 2. Large historical complexes, palaces, forts, major multi-level rock-cut cave complexes (60 - 90 mins)
  if (
    combined.includes('palace') ||
    combined.includes('fort') ||
    combined.includes('citadel') ||
    combined.includes('four storeys') ||
    combined.includes('undavalli') ||
    combined.includes('heritage complex') ||
    combined.includes('archeological site') ||
    combined.includes('historical complex')
  ) {
    if (combined.includes('fort') || combined.includes('palace')) {
      return 90;
    }
    return 60;
  }

  // 3. Small monuments, statues, stupas, memorials, pillars, gates, viewpoints (20 - 35 mins)
  if (
    combined.includes('monument') ||
    combined.includes('statue') ||
    combined.includes('stupa') ||
    combined.includes('pillar') ||
    combined.includes('arch') ||
    combined.includes('memorial') ||
    combined.includes('clock tower') ||
    combined.includes('gate') ||
    combined.includes('lookout') ||
    combined.includes('viewpoint') ||
    combined.includes('scenic point') ||
    combined.includes('sunset point') ||
    combined.includes('cliff cave') ||
    combined.includes('mogalarajapuram')
  ) {
    if (combined.includes('planetarium') || combined.includes('gandhi hill')) {
      return 35;
    }
    if (combined.includes('cave')) {
      return 30; // small cliff cave like Mogalarajapuram
    }
    return 25; // small monument / statue
  }

  // 4. Museums and Galleries (50 - 60 mins)
  if (
    combined.includes('museum') ||
    combined.includes('gallery') ||
    combined.includes('science center') ||
    combined.includes('planetarium')
  ) {
    if (
      combined.includes('national') ||
      combined.includes('archeological') ||
      combined.includes('jubilee') ||
      combined.includes('bapu')
    ) {
      return 60;
    }
    return 50;
  }

  // 5. Temples and Religious Sites (25 - 60 mins)
  if (
    combined.includes('temple') ||
    combined.includes('shrine') ||
    combined.includes('ashram') ||
    combined.includes('church') ||
    combined.includes('mosque') ||
    combined.includes('basilica') ||
    combined.includes('gurdwara')
  ) {
    if (
      combined.includes('hilltop') ||
      combined.includes('indrakeeladri') ||
      combined.includes('kanaka durga') ||
      combined.includes('ropeway') ||
      combined.includes('ghat road') ||
      combined.includes('pilgrimage') ||
      combined.includes('complex')
    ) {
      return 50;
    }
    return 30; // moderate temple default
  }

  // 6. Waterfronts, bridges, barrages, promenades (40 mins)
  if (
    combined.includes('barrage') ||
    combined.includes('prakasam') ||
    combined.includes('promenade') ||
    combined.includes('bridge') ||
    combined.includes('ghat')
  ) {
    return 40;
  }

  // 7. Shopping, Bazaars & Street Food (45 mins)
  if (
    combined.includes('bazaar') ||
    combined.includes('market') ||
    combined.includes('sweet street') ||
    combined.includes('shopping')
  ) {
    return 45;
  }

  // 8. Sensible category-based fallbacks (Requirement 3)
  const normCategory = normalizeCategory(place.category);
  switch (normCategory) {
    case 'viewpoint':
      return 20; // Viewpoint → shorter default
    case 'landmark':
      return 25; // Small attraction/landmark → shorter default
    case 'temple':
      return 30; // Temple → moderate default
    case 'museum':
      return 60; // Museum → moderate default
    case 'historical':
      return 45; // Historical complex/site → moderate/longer default
    case 'park':
      return 45; // Park → moderate default
    case 'entertainment':
      return 60;
    case 'shopping':
      return 45;
    case 'food':
      return 40;
    case 'other':
    default:
      return 30;
  }
}

/**
 * Gets the estimated visit duration for a destination in minutes.
 * Priority: explicit estimatedVisitMinutes > visitDuration metadata > signal-based inference > category fallback.
 */
export function getDestinationEstimatedDuration(dest: Partial<Destination>): number {
  if (typeof dest.estimatedVisitMinutes === 'number' && dest.estimatedVisitMinutes > 0) {
    return Math.round(dest.estimatedVisitMinutes);
  }
  if (typeof dest.visitDuration === 'number' && dest.visitDuration > 0) {
    return Math.round(dest.visitDuration);
  }
  if (typeof dest.visitDurationMinutes === 'number' && dest.visitDurationMinutes > 0) {
    return Math.round(dest.visitDurationMinutes);
  }
  return inferVisitDurationFromSignals(dest);
}

/**
 * Gets the effective visit duration used by calculations:
 * Uses user-selected duration when the user has changed it.
 * Otherwise uses destination estimated visit duration.
 */
export function getEffectiveVisitDuration(dest: Partial<Destination>): number {
  if (typeof dest.userVisitMinutes === 'number' && dest.userVisitMinutes > 0) {
    return Math.round(dest.userVisitMinutes);
  }
  return getDestinationEstimatedDuration(dest);
}

export function hasExplicitDestinationDuration(dest: Partial<Destination>): boolean {
  return (
    (typeof dest.estimatedVisitMinutes === 'number' && dest.estimatedVisitMinutes > 0) ||
    (typeof dest.visitDuration === 'number' && dest.visitDuration > 0) ||
    (typeof dest.visitDurationMinutes === 'number' && dest.visitDurationMinutes > 0)
  );
}

/**
 * Formats a visit duration label distinguishing destination-specific data vs fallback estimate vs user planned time.
 */
export function formatVisitDurationDisplay(dest: Partial<Destination>): {
  label: string;
  isUserCustomized: boolean;
  hasReliableDuration: boolean;
  isEstimated: boolean;
  badgeLabel: string;
  durationMinutes: number;
  estimatedMinutes: number;
} {
  const est = getDestinationEstimatedDuration(dest);
  const isCustomized =
    typeof dest.userVisitMinutes === 'number' &&
    dest.userVisitMinutes > 0 &&
    dest.userVisitMinutes !== est;

  const durationMinutes = isCustomized ? Math.round(dest.userVisitMinutes!) : est;
  const hasReliable = hasExplicitDestinationDuration(dest);
  const isEstimated = !isCustomized && !hasReliable;

  let badgeLabel = 'Destination data';
  let label = `Visit duration: ${durationMinutes} min`;

  if (isCustomized) {
    badgeLabel = 'Customized';
    label = `Your planned visit time: ${durationMinutes} min`;
  } else if (isEstimated) {
    badgeLabel = 'Estimated';
    label = `Estimated visit time: ${durationMinutes} min (Estimated)`;
  } else {
    badgeLabel = 'Destination data';
    label = `Visit duration: ${durationMinutes} min`;
  }

  return {
    label,
    isUserCustomized: isCustomized,
    hasReliableDuration: hasReliable,
    isEstimated,
    badgeLabel,
    durationMinutes,
    estimatedMinutes: est,
  };
}
