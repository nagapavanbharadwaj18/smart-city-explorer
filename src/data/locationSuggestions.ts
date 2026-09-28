export interface LocationSuggestion {
  id: string;
  name: string;
  secondaryText: string;
  type: 'station' | 'airport' | 'bus_terminal' | 'landmark' | 'commercial' | 'hotel' | 'neighborhood' | 'city';
  distance?: string;
  city?: string;
  lat?: number;
  lon?: number;
  tags?: string[];
}

// Multi-City Curated Database with exact GPS coordinates for instant offline & online search
export const MULTI_CITY_LOCATIONS_DATABASE: LocationSuggestion[] = [
  // --- KANCHIPURAM ---
  {
    id: 'kanchi-1',
    name: 'Sri Kanchi Kamakoti Peetam',
    secondaryText: '1, Salai Street, Periya Kanchipuram, Tamil Nadu 631502',
    type: 'landmark',
    city: 'Kanchipuram',
    lat: 12.8436,
    lon: 79.7008,
    distance: 'City Center',
    tags: ['kanchipuram', 'kanchi', 'kamakoti', 'peetam', 'mutt', 'sankara mutt', 'sankaracharya', 'temple'],
  },
  {
    id: 'kanchi-3',
    name: 'Ekambaranathar Temple',
    secondaryText: 'North Sannathi Street, Periya Kanchipuram, Tamil Nadu 631502',
    type: 'landmark',
    city: 'Kanchipuram',
    lat: 12.8475,
    lon: 79.6997,
    distance: '0.5 km away',
    tags: ['kanchipuram', 'ekambaranathar', 'ekambareswarar', 'shiva', 'pancha bhoota', 'temple'],
  },
  {
    id: 'kanchi-7',
    name: 'Sri Kanchi Kamakshi Amman Temple',
    secondaryText: 'Kamakshi Amman Sannadhi Street, Kanchipuram, Tamil Nadu 631502',
    type: 'landmark',
    city: 'Kanchipuram',
    lat: 12.8398,
    lon: 79.7042,
    distance: '1.4 km away',
    tags: ['kanchipuram', 'kamakshi', 'amman', 'shakti peeth', 'devi', 'temple'],
  },
  {
    id: 'kanchi-2',
    name: 'Kanchi Kailasanathar Temple',
    secondaryText: 'Pillaiyarpalayam, Kanchipuram, Tamil Nadu 631501',
    type: 'landmark',
    city: 'Kanchipuram',
    lat: 12.8422,
    lon: 79.6897,
    distance: '1.8 km away',
    tags: ['kanchipuram', 'kailasanathar', 'temple', 'pallava', 'heritage', 'architecture'],
  },
  {
    id: 'kanchi-4',
    name: 'Varadharaja Perumal Temple',
    secondaryText: 'Vishnu Kanchi, Kanchipuram, Tamil Nadu 631501',
    type: 'landmark',
    city: 'Kanchipuram',
    lat: 12.8197,
    lon: 79.7247,
    distance: '3.5 km away',
    tags: ['kanchipuram', 'varadharaja', 'perumal', 'vishnu', 'divya desam', 'temple'],
  },
  {
    id: 'kanchi-5',
    name: 'Kanchipuram Railway Station',
    secondaryText: 'Station Road, Kanchipuram, Tamil Nadu 631501',
    type: 'station',
    city: 'Kanchipuram',
    lat: 12.8277,
    lon: 79.7093,
    distance: '1.0 km away',
    tags: ['kanchipuram', 'railway', 'station', 'train'],
  },
  {
    id: 'kanchi-6',
    name: 'Kanchipuram Central Bus Stand',
    secondaryText: 'Gandhi Road, Kanchipuram, Tamil Nadu 631501',
    type: 'bus_terminal',
    city: 'Kanchipuram',
    lat: 12.8320,
    lon: 79.7050,
    distance: '0.5 km away',
    tags: ['kanchipuram', 'bus stand', 'bus', 'gandhi road'],
  },

  // --- ARAKKONAM & RANIPET / VELLORE REGION ---
  {
    id: 'arakkonam-1',
    name: 'Arakkonam Junction Railway Station',
    secondaryText: 'Station Road, Railway Colony, Arakkonam, Tamil Nadu 631001',
    type: 'station',
    city: 'Arakkonam',
    lat: 13.0805,
    lon: 79.6702,
    distance: '0.1 km from center',
    tags: ['arakkonam', 'junction', 'train', 'station', 'southern railway', 'ajj'],
  },
  {
    id: 'arakkonam-2',
    name: 'Arakkonam Old Bus Stand',
    secondaryText: 'Gandhi Road, Stuartpet, Arakkonam, Tamil Nadu 631001',
    type: 'bus_terminal',
    city: 'Arakkonam',
    lat: 13.0789,
    lon: 79.6675,
    distance: '0.8 km from center',
    tags: ['arakkonam', 'bus stand', 'bus', 'gandhi road', 'stuartpet'],
  },
  {
    id: 'arakkonam-3',
    name: 'Arakkonam New Bus Terminal',
    secondaryText: 'Tiruttani Road, Winterpet, Arakkonam, Tamil Nadu 631005',
    type: 'bus_terminal',
    city: 'Arakkonam',
    lat: 13.0845,
    lon: 79.6730,
    distance: '1.8 km away',
    tags: ['arakkonam', 'new bus stand', 'winterpet', 'tiruttani road'],
  },
  {
    id: 'arakkonam-4',
    name: 'INS Rajali Naval Air Station',
    secondaryText: 'Camp Road, Arakkonam Naval Base, Tamil Nadu 631002',
    type: 'airport',
    city: 'Arakkonam',
    lat: 13.0712,
    lon: 79.6890,
    distance: '4.5 km away',
    tags: ['arakkonam', 'ins rajali', 'naval', 'air base', 'runway'],
  },
  {
    id: 'arakkonam-5',
    name: 'Stuartpet Gandhi Road Market',
    secondaryText: 'Bazaar Street, Stuartpet, Arakkonam, Tamil Nadu',
    type: 'commercial',
    city: 'Arakkonam',
    lat: 13.0792,
    lon: 79.6685,
    distance: '0.6 km away',
    tags: ['arakkonam', 'stuartpet', 'market', 'shopping', 'bazaar'],
  },
  {
    id: 'arakkonam-6',
    name: 'Thiruvalangadu Temple Entrance',
    secondaryText: 'Vadaranyeswarar Temple Road, Thiruvalangadu, near Arakkonam',
    type: 'landmark',
    city: 'Arakkonam',
    lat: 13.1342,
    lon: 79.7745,
    distance: '11.2 km away',
    tags: ['arakkonam', 'thiruvalangadu', 'temple', 'shiva', 'heritage'],
  },
  {
    id: 'arakkonam-7',
    name: 'Winterpet Clock Tower Junction',
    secondaryText: 'Railway Colony Road, Winterpet, Arakkonam 631005',
    type: 'neighborhood',
    city: 'Arakkonam',
    lat: 13.0815,
    lon: 79.6698,
    distance: '1.2 km away',
    tags: ['arakkonam', 'winterpet', 'clock tower', 'junction'],
  },

  // --- VIJAYAWADA ---
  {
    id: 'vja-1',
    name: 'Vijayawada Central Railway Station',
    secondaryText: 'Station Road, Tarapet, Vijayawada, Andhra Pradesh 520001',
    type: 'station',
    city: 'Vijayawada',
    lat: 16.5175,
    lon: 80.6200,
    distance: '0.2 km away',
    tags: ['train', 'station', 'central', 'railway', 'junction', 'vijayawada'],
  },
  {
    id: 'vja-2',
    name: 'Pandit Nehru Bus Station (PNBS)',
    secondaryText: 'NH 65, Krishna Lanka, Vijayawada, Andhra Pradesh 520013',
    type: 'bus_terminal',
    city: 'Vijayawada',
    lat: 16.5075,
    lon: 80.6265,
    distance: '1.4 km away',
    tags: ['bus', 'terminal', 'pnbs', 'apsrtc', 'interstate', 'vijayawada', 'pandit nehru'],
  },
  {
    id: 'vja-3',
    name: 'Vijayawada International Airport (Gannavaram)',
    secondaryText: 'NH 16, Gannavaram, Andhra Pradesh 521102',
    type: 'airport',
    city: 'Vijayawada',
    lat: 16.5284,
    lon: 80.7968,
    distance: '18.5 km away',
    tags: ['airport', 'flight', 'terminal', 'gannavaram', 'vga', 'vijayawada'],
  },
  {
    id: 'vja-4',
    name: 'Benz Circle',
    secondaryText: 'MG Road & Bandar Road Junction, Vijayawada, Andhra Pradesh',
    type: 'commercial',
    city: 'Vijayawada',
    lat: 16.4998,
    lon: 80.6540,
    distance: '3.1 km away',
    tags: ['benz circle', 'mg road', 'bandar road', 'junction', 'shopping', 'vijayawada'],
  },
  {
    id: 'vja-5',
    name: 'Prakasam Barrage North Ghat',
    secondaryText: 'Barrage Approach Road, Governorpet, Vijayawada',
    type: 'landmark',
    city: 'Vijayawada',
    lat: 16.5085,
    lon: 80.6067,
    distance: '2.8 km away',
    tags: ['prakasam barrage', 'krishna river', 'ghat', 'bridge', 'vijayawada'],
  },
  {
    id: 'vja-6',
    name: 'Bhavani Island Ferry Terminal',
    secondaryText: 'Bhavani Island Road, Bhavanipuram, Vijayawada',
    type: 'landmark',
    city: 'Vijayawada',
    lat: 16.5167,
    lon: 80.5912,
    distance: '4.0 km away',
    tags: ['bhavani island', 'ferry', 'terminal', 'vijayawada'],
  },
  {
    id: 'vja-7',
    name: 'Governorpet Center',
    secondaryText: 'Governorpet, Vijayawada, Andhra Pradesh 520002',
    type: 'commercial',
    city: 'Vijayawada',
    lat: 16.5122,
    lon: 80.6288,
    distance: '1.0 km away',
    tags: ['governorpet', 'center', 'market', 'vijayawada'],
  },

  // --- CHENNAI ---
  {
    id: 'chn-1',
    name: 'Chennai Central Railway Station (Puratchi Thalaivar Dr. MGR)',
    secondaryText: 'Kannappar Thidal, Periyamet, Chennai, Tamil Nadu 600003',
    type: 'station',
    city: 'Chennai',
    lat: 13.0827,
    lon: 80.2755,
    distance: 'City Center',
    tags: ['chennai', 'central', 'railway', 'station', 'mas', 'mgr'],
  },
  {
    id: 'chn-2',
    name: 'Chennai International Airport (MAA)',
    secondaryText: 'GST Road, Meenambakkam, Chennai, Tamil Nadu 600027',
    type: 'airport',
    city: 'Chennai',
    lat: 12.9941,
    lon: 80.1709,
    distance: '15 km away',
    tags: ['chennai', 'airport', 'maa', 'meenambakkam'],
  },
  {
    id: 'chn-3',
    name: 'Puratchi Thalaivar Dr. M.G.R. Bus Terminus (CMBT Koyambedu)',
    secondaryText: 'Jawaharlal Nehru Road, Koyambedu, Chennai, Tamil Nadu',
    type: 'bus_terminal',
    city: 'Chennai',
    lat: 13.0674,
    lon: 80.2057,
    distance: '8 km away',
    tags: ['chennai', 'cmbt', 'koyambedu', 'bus stand'],
  },
  {
    id: 'chn-4',
    name: 'Marina Beach Promenade',
    secondaryText: 'Kamarajar Salai, Triplicane, Chennai, Tamil Nadu',
    type: 'landmark',
    city: 'Chennai',
    lat: 13.0500,
    lon: 80.2824,
    distance: '4.2 km away',
    tags: ['chennai', 'marina beach', 'lighthouse', 'promenade'],
  },

  // --- BENGALURU ---
  {
    id: 'blr-1',
    name: 'Krantivira Sangolli Rayanna (Bengaluru City / Majestic)',
    secondaryText: 'Kempegowda, Sevashrama, Bengaluru, Karnataka 560023',
    type: 'station',
    city: 'Bengaluru',
    lat: 12.9781,
    lon: 77.5696,
    distance: 'City Center',
    tags: ['bengaluru', 'bangalore', 'majestic', 'station', 'ksr'],
  },
  {
    id: 'blr-2',
    name: 'Kempegowda International Airport (BLR)',
    secondaryText: 'KIAL Road, Devanahalli, Bengaluru, Karnataka 560300',
    type: 'airport',
    city: 'Bengaluru',
    lat: 13.1986,
    lon: 77.7066,
    distance: '34 km away',
    tags: ['bengaluru', 'bangalore', 'airport', 'kial', 'devanahalli'],
  },

  // --- HYDERABAD ---
  {
    id: 'hyd-1',
    name: 'Secunderabad Junction Railway Station',
    secondaryText: 'Station Road, Regimental Bazaar, Secunderabad, Telangana',
    type: 'station',
    city: 'Hyderabad',
    lat: 17.4344,
    lon: 78.5015,
    distance: 'City Center',
    tags: ['hyderabad', 'secunderabad', 'railway', 'station'],
  },
  {
    id: 'hyd-2',
    name: 'Rajiv Gandhi International Airport (HYD)',
    secondaryText: 'Shamshabad, Hyderabad, Telangana 500409',
    type: 'airport',
    city: 'Hyderabad',
    lat: 17.2403,
    lon: 78.4294,
    distance: '24 km away',
    tags: ['hyderabad', 'airport', 'shamshabad', 'rgia'],
  },
  {
    id: 'hyd-3',
    name: 'Charminar Heritage Plaza',
    secondaryText: 'Charminar Road, Old City, Hyderabad, Telangana',
    type: 'landmark',
    city: 'Hyderabad',
    lat: 17.3616,
    lon: 78.4747,
    distance: '5.2 km away',
    tags: ['hyderabad', 'charminar', 'monument', 'old city'],
  },

  // --- DELHI ---
  {
    id: 'del-1',
    name: 'New Delhi Railway Station (NDLS)',
    secondaryText: 'Bhavbhuti Marg, Ratan Lal Market, Kamla Market, New Delhi',
    type: 'station',
    city: 'Delhi',
    lat: 28.6431,
    lon: 77.2197,
    distance: 'City Center',
    tags: ['delhi', 'new delhi', 'ndls', 'station', 'railway'],
  },
  {
    id: 'del-2',
    name: 'Indira Gandhi International Airport (DEL)',
    secondaryText: 'Palam, New Delhi, Delhi 110037',
    type: 'airport',
    city: 'Delhi',
    lat: 28.5562,
    lon: 77.1000,
    distance: '16 km away',
    tags: ['delhi', 'airport', 'igi', 'terminal 3'],
  },

  // --- MUMBAI ---
  {
    id: 'mum-1',
    name: 'Chhatrapati Shivaji Maharaj Terminus (CSMT)',
    secondaryText: 'Fort, Mumbai, Maharashtra 400001',
    type: 'station',
    city: 'Mumbai',
    lat: 18.9400,
    lon: 72.8353,
    distance: 'South Mumbai',
    tags: ['mumbai', 'csmt', 'vt', 'station', 'fort'],
  },
  {
    id: 'mum-2',
    name: 'Chhatrapati Shivaji Maharaj International Airport (BOM)',
    secondaryText: 'Sahar, Andheri East, Mumbai, Maharashtra 400099',
    type: 'airport',
    city: 'Mumbai',
    lat: 19.0896,
    lon: 72.8656,
    distance: '12 km away',
    tags: ['mumbai', 'airport', 'bom', 'andheri', 'sahar'],
  },
];

// Helper to determine location type from OpenStreetMap classifications
function mapOsmType(osmClass: string, osmType: string): LocationSuggestion['type'] {
  if (osmClass === 'railway' || osmType.includes('station') || osmType.includes('halt')) {
    return 'station';
  }
  if (osmClass === 'aeroway' || osmType.includes('airport') || osmType.includes('terminal')) {
    return 'airport';
  }
  if (osmType.includes('bus') || osmType.includes('transportation')) {
    return 'bus_terminal';
  }
  if (osmClass === 'tourism' || osmClass === 'historic' || osmClass === 'monument') {
    return 'landmark';
  }
  if (osmClass === 'shop' || osmClass === 'commercial' || osmType === 'mall') {
    return 'commercial';
  }
  if (osmType.includes('hotel') || osmType.includes('lodging')) {
    return 'hotel';
  }
  if (osmClass === 'place' && (osmType === 'city' || osmType === 'town' || osmType === 'village')) {
    return 'city';
  }
  return 'neighborhood';
}

// In-memory cache to prevent repeated requests
const geocodeCache = new Map<string, LocationSuggestion[]>();

/**
 * Real geocoding function supporting ANY city, landmark, or street in the world
 */
export async function searchLocationsOnline(query: string, signal?: AbortSignal): Promise<LocationSuggestion[]> {
  const q = query.trim();
  if (!q) {
    return MULTI_CITY_LOCATIONS_DATABASE.slice(0, 6);
  }

  const cacheKey = q.toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  // First, check local curated database with strict ranking
  const localMatches = searchLocations(q);

  // Query Google Places API (New) Text Search for instant live autocomplete
  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      : '') ||
    (typeof process !== 'undefined' && process.env
      ? process.env.VITE_GOOGLE_MAPS_API_KEY
      : '') ||
    '';

  const googleResults: LocationSuggestion[] = [];

  if (apiKey) {
    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.types',
        },
        body: JSON.stringify({
          textQuery: q,
          pageSize: 5,
        }),
        signal,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.places && Array.isArray(data.places)) {
          for (const place of data.places) {
            if (
              place.location?.latitude !== undefined &&
              place.location?.longitude !== undefined
            ) {
              const primaryName = place.displayName?.text || place.formattedAddress?.split(',')[0] || q;
              googleResults.push({
                id: `google-${place.id}`,
                name: primaryName,
                secondaryText: place.formattedAddress || primaryName,
                type: 'landmark',
                lat: place.location.latitude,
                lon: place.location.longitude,
                distance: 'Live Map Match',
              });
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      console.warn('Google Places live geocode error:', err);
    }
  }

  // Also query OpenStreetMap Nominatim for fallback geocoding
  let osmResults: LocationSuggestion[] = [];
  if (googleResults.length === 0) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        q
      )}&format=json&addressdetails=1&limit=6&accept-language=en`;

      const res = await fetch(url, {
        signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        osmResults = data.map((item: any) => {
          const addr = item.address || {};
          const cityName =
            addr.city ||
            addr.town ||
            addr.village ||
            addr.municipality ||
            addr.state_district ||
            addr.county ||
            '';
          const stateName = addr.state || '';
          const countryName = addr.country || '';

          const primaryName = item.name || item.display_name.split(',')[0].trim();
          const displayParts = item.display_name.split(',').map((s: string) => s.trim());
          const secondary =
            displayParts.slice(1, 4).join(', ') ||
            [cityName, stateName, countryName].filter(Boolean).join(', ');

          return {
            id: `osm-${item.place_id}`,
            name: primaryName,
            secondaryText: secondary,
            type: mapOsmType(item.class, item.type),
            city: cityName || primaryName,
            lat: parseFloat(item.lat),
            lon: parseFloat(item.lon),
            distance: 'Global Geocoding Match',
          };
        });
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      console.warn('Nominatim geocoder error or offline:', err);
    }
  }

  // Combine local matches + live API results (deduplicating by similar name)
  const combined = [...localMatches];
  for (const item of [...googleResults, ...osmResults]) {
    if (!combined.some((c) => c.name.toLowerCase() === item.name.toLowerCase())) {
      combined.push(item);
    }
  }

  if (combined.length > 0) {
    geocodeCache.set(cacheKey, combined);
    return combined;
  }

  // If all lookups return empty, return local matches
  return localMatches;
}

/**
 * Synchronous local search for immediate typing responsiveness with strict relevance
 */
export function searchLocations(query: string): LocationSuggestion[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return MULTI_CITY_LOCATIONS_DATABASE.slice(0, 6);
  }

  const scored = MULTI_CITY_LOCATIONS_DATABASE.map((loc) => {
    const nameLower = loc.name.toLowerCase();
    const secLower = loc.secondaryText.toLowerCase();
    const cityLower = (loc.city || '').toLowerCase();
    let score = 0;

    if (nameLower === q) score = 100;
    else if (nameLower.startsWith(q)) score = 80;
    else if (nameLower.includes(q)) score = 60;
    else if (cityLower === q) score = 50;
    else if (cityLower.startsWith(q)) score = 40;
    else if (secLower.includes(q)) score = 30;
    else if (loc.tags && loc.tags.some((tag) => tag.toLowerCase() === q || tag.toLowerCase().startsWith(q))) score = 20;

    return { loc, score };
  })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.loc);

  return scored;
}

/**
 * Resolves exact geographic coordinates for any place name or address string.
 * Used whenever a selected location is missing coordinates.
 */
export async function geocodeLocationName(
  locationName: string
): Promise<{
  name: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  city?: string;
  placeId: string;
} | null> {
  if (!locationName || !locationName.trim()) return null;
  const trimmed = locationName.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check curated database for exact name, id, or strong prefix
  const exactMatch = MULTI_CITY_LOCATIONS_DATABASE.find(
    (item) =>
      item.name.toLowerCase() === lower ||
      item.id.toLowerCase() === lower ||
      (item.tags && item.tags.some((t) => t.toLowerCase() === lower))
  );

  if (exactMatch && exactMatch.lat !== undefined && exactMatch.lon !== undefined) {
    return {
      name: exactMatch.name,
      latitude: exactMatch.lat,
      longitude: exactMatch.lon,
      formattedAddress: exactMatch.secondaryText || exactMatch.name,
      city: exactMatch.city,
      placeId: exactMatch.id,
    };
  }

  const partialMatch = MULTI_CITY_LOCATIONS_DATABASE.find(
    (item) =>
      lower.length >= 4 &&
      (item.name.toLowerCase().includes(lower) || lower.includes(item.name.toLowerCase()))
  );

  if (partialMatch && partialMatch.lat !== undefined && partialMatch.lon !== undefined) {
    return {
      name: partialMatch.name,
      latitude: partialMatch.lat,
      longitude: partialMatch.lon,
      formattedAddress: partialMatch.secondaryText || partialMatch.name,
      city: partialMatch.city,
      placeId: partialMatch.id,
    };
  }

  // 2. Query Google Places API (New) Text Search
  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      : '') ||
    (typeof process !== 'undefined' && process.env
      ? process.env.VITE_GOOGLE_MAPS_API_KEY
      : '') ||
    '';

  if (apiKey) {
    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
        },
        body: JSON.stringify({
          textQuery: trimmed,
          pageSize: 1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.places && data.places.length > 0) {
          const place = data.places[0];
          if (
            place.location?.latitude !== undefined &&
            place.location?.longitude !== undefined
          ) {
            return {
              name: place.displayName?.text || trimmed,
              latitude: place.location.latitude,
              longitude: place.location.longitude,
              formattedAddress: place.formattedAddress || trimmed,
              city: detectCityFromLocation(place.formattedAddress || trimmed),
              placeId: place.id || `place-${place.location.latitude}-${place.location.longitude}`,
            };
          }
        }
      }
    } catch (err) {
      console.warn('Google Places geocode error:', err);
    }
  }

  // 3. OpenStreetMap Nominatim Fallback
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      trimmed
    )}&format=json&limit=1&accept-language=en`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          return {
            name: trimmed,
            latitude: lat,
            longitude: lon,
            formattedAddress: item.display_name,
            city: detectCityFromLocation(item.display_name || trimmed),
            placeId: `osm-${item.osm_id || item.place_id || `${lat}-${lon}`}`,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Nominatim fallback geocode error:', err);
  }

  return null;
}

/**
 * Extracts city name from a selected location or address string
 */
export function detectCityFromLocation(locationText: string): string {
  if (!locationText || !locationText.trim()) return '';

  const lower = locationText.toLowerCase().trim();

  // Known city heuristics
  if (lower.includes('arakkonam')) return 'Arakkonam';
  if (lower.includes('chennai') || lower.includes('madras')) return 'Chennai';
  if (lower.includes('bengaluru') || lower.includes('bangalore')) return 'Bengaluru';
  if (lower.includes('hyderabad') || lower.includes('secunderabad')) return 'Hyderabad';
  if (lower.includes('mumbai') || lower.includes('bombay')) return 'Mumbai';
  if (lower.includes('delhi') || lower.includes('new delhi')) return 'Delhi';
  if (lower.includes('vijayawada') || lower.includes('bezawada')) return 'Vijayawada';
  if (lower.includes('vellore')) return 'Vellore';
  if (lower.includes('kanchipuram') || lower.includes('kanchi') || lower.includes('conjeevaram')) return 'Kanchipuram';
  if (lower.includes('tirupati')) return 'Tirupati';
  if (lower.includes('coimbatore')) return 'Coimbatore';
  if (lower.includes('pune')) return 'Pune';
  if (lower.includes('kolkata') || lower.includes('calcutta')) return 'Kolkata';
  if (lower.includes('jaipur')) return 'Jaipur';
  if (lower.includes('goa')) return 'Goa';
  if (lower.includes('mysuru') || lower.includes('mysore')) return 'Mysore';
  if (lower.includes('visakhapatnam') || lower.includes('vizag')) return 'Visakhapatnam';
  if (lower.includes('varanasi') || lower.includes('banaras') || lower.includes('kashi')) return 'Varanasi';
  if (lower.includes('madurai')) return 'Madurai';
  if (lower.includes('agra')) return 'Agra';
  if (lower.includes('kochi') || lower.includes('cochin')) return 'Kochi';
  if (lower.includes('ahmedabad')) return 'Ahmedabad';

  // Extract from comma-separated address (e.g. "Station Road, Kanchipuram, Tamil Nadu 631501")
  const parts = locationText.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i].replace(/\d+/g, '').trim();
      const lowerPart = part.toLowerCase();
      if (
        ['india', 'tamil nadu', 'andhra pradesh', 'telangana', 'karnataka', 'maharashtra', 'kerala', 'rajasthan', 'uttar pradesh', 'gujarat', 'west bengal'].includes(lowerPart)
      ) {
        continue;
      }
      if (part.length >= 3 && !/\b(street|road|lane|nagar|colony|junction|station|terminal|airport)\b/i.test(part)) {
        return part;
      }
    }
  }

  const cleaned = locationText
    .replace(/\b(Central|Railway|Station|Airport|Bus|Stand|Terminal|Junction|Main|North|South|East|West|Road|Street|Near|Opposite|Circle|Plaza|Expressway|Highway|Jn)\b/gi, '')
    .trim();

  const words = cleaned.split(/\s+/).filter((w) => w.length > 2);
  if (words.length > 0) {
    return words[0].charAt(0).toUpperCase() + words[0].slice(1);
  }

  return locationText.trim();
}
