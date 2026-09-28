/**
 * Service for acquiring and resolving device geolocation.
 * Adheres strictly to browser Geolocation API and Google Maps / OSM reverse geocoding.
 */

export interface DeviceGeolocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  isLowAccuracy: boolean;
  accuracyWarning?: string;
  locationName: string;
  formattedAddress: string;
  city?: string;
}

export interface GeolocationErrorResult {
  code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED' | 'UNKNOWN';
  message: string;
}

/**
 * Reverses geocodes latitude and longitude into an address / place name.
 * Attempts Google Maps Geocoding API first, then OSM Nominatim as fallback.
 */
export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number
): Promise<{ locationName: string; formattedAddress: string; city?: string }> {
  const apiKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_MAPS_API_KEY) ||
    '';

  // 1. Try Google Maps Geocoding API if key is configured
  if (apiKey) {
    try {
      const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
      const res = await fetch(googleUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const first = data.results[0];
          const formattedAddress = first.formatted_address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          
          // Extract city / locality
          let city: string | undefined;
          for (const comp of first.address_components || []) {
            if (comp.types.includes('locality') || comp.types.includes('administrative_area_level_2')) {
              city = comp.long_name;
              break;
            }
          }

          // Build concise location name
          const primaryName = first.address_components?.[0]?.long_name || city || 'Current Location';
          const locationName = `${primaryName} (${city || 'Local Area'})`;

          return {
            locationName,
            formattedAddress,
            city,
          };
        }
      }
    } catch (err) {
      console.warn('Google reverse geocoding failed or CORS blocked, falling back to OSM Nominatim:', err);
    }
  }

  // 2. OpenStreetMap Nominatim reverse geocoding fallback
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&accept-language=en`;
    const res = await fetch(osmUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const cityName =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.municipality ||
        addr.suburb ||
        addr.state_district ||
        '';

      const pointName =
        addr.road ||
        addr.neighbourhood ||
        addr.suburb ||
        data.name ||
        data.display_name.split(',')[0] ||
        'Current Location';

      const formattedAddress = data.display_name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      const locationName = cityName ? `${pointName}, ${cityName}` : pointName;

      return {
        locationName,
        formattedAddress,
        city: cityName,
      };
    }
  } catch (err) {
    console.warn('OSM Nominatim reverse geocoding error:', err);
  }

  // 3. Fallback: coordinate-based label
  const coordStr = `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
  return {
    locationName: `Current Location (${coordStr})`,
    formattedAddress: `Current Location (${coordStr})`,
  };
}

/**
 * Obtains fresh device coordinates using navigator.geolocation.getCurrentPosition.
 * Enforces maximumAge: 0 so stale coordinates are never reused.
 */
export function obtainDeviceLocation(): Promise<DeviceGeolocationResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const err: GeolocationErrorResult = {
        code: 'NOT_SUPPORTED',
        message: 'Geolocation is not supported by your browser. Please enter your starting location manually.',
      };
      return reject(err);
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        // Accuracy evaluation (threshold: 1000 meters)
        const isLowAccuracy = typeof accuracy === 'number' && accuracy > 1000;
        const accuracyWarning = isLowAccuracy
          ? 'Location accuracy is low. Please confirm your starting location.'
          : undefined;

        try {
          const { locationName, formattedAddress, city } = await reverseGeocodeCoordinates(
            latitude,
            longitude
          );

          resolve({
            latitude,
            longitude,
            accuracy,
            isLowAccuracy,
            accuracyWarning,
            locationName,
            formattedAddress,
            city,
          });
        } catch (revErr) {
          // If reverse geocoding fails, still resolve with coordinate string rather than failing
          const coordStr = `${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°`;
          resolve({
            latitude,
            longitude,
            accuracy,
            isLowAccuracy,
            accuracyWarning,
            locationName: `Current Location (${coordStr})`,
            formattedAddress: `Current Location (${coordStr})`,
          });
        }
      },
      (geoError) => {
        let errorResult: GeolocationErrorResult;
        switch (geoError.code) {
          case geoError.PERMISSION_DENIED:
            errorResult = {
              code: 'PERMISSION_DENIED',
              message: 'Location permission was not granted. Please enter your starting location manually.',
            };
            break;
          case geoError.POSITION_UNAVAILABLE:
            errorResult = {
              code: 'POSITION_UNAVAILABLE',
              message: 'Location position is currently unavailable. Please enter your starting location manually.',
            };
            break;
          case geoError.TIMEOUT:
            errorResult = {
              code: 'TIMEOUT',
              message: 'Location request timed out. Please enter your starting location manually.',
            };
            break;
          default:
            errorResult = {
              code: 'UNKNOWN',
              message: 'Unable to retrieve your location. Please enter your starting location manually.',
            };
        }
        reject(errorResult);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0, // Force fresh position lookup
      }
    );
  });
}
