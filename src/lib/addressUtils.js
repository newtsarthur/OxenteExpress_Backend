import axios from 'axios';

export function normalizeAddressString(address) {
  if (!address || typeof address !== 'string') return address;
  return address
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*-\s*/g, ' - ');
}

export function formatAddressFromNominatim(result) {
  if (!result || typeof result !== 'object') return '';
  const address = result.address || {};
  const rawDisplay = String(result.display_name || '').trim();

  const street =
    address.road ||
    address.pedestrian ||
    address.cycleway ||
    address.path ||
    address.footway ||
    address.residential ||
    address.neighbourhood ||
    address.suburb ||
    address.village ||
    address.town ||
    address.hamlet;

  const number = address.house_number || address.housenumber;
  const neighborhood =
    address.neighbourhood ||
    address.suburb ||
    address.quarter ||
    address.village ||
    address.hamlet;
  const city = address.city || address.town || address.village || address.county;
  const state = address.state_code || address.state || address.region || address.state_district || address.county;

  const parts = [];
  if (street) {
    parts.push(number ? `${street}, ${number}` : street);
  } else if (number) {
    parts.push(String(number));
  }

  if (neighborhood && neighborhood !== street) {
    parts.push(neighborhood);
  }
  if (city && city !== neighborhood) {
    parts.push(city);
  }

  let formatted = parts.join(', ');
  if (formatted && state) {
    formatted += ` - ${state}`;
  }

  if (!formatted) {
    formatted = rawDisplay;
  }

  return normalizeAddressString(formatted);
}

export async function geocodeAddressAndFormat(address) {
  if (!address || typeof address !== 'string') return null;
  const encodedAddress = encodeURIComponent(address.trim());
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodedAddress}&limit=1`;

  const response = await axios.get(url, {
    headers: { 'User-Agent': 'OxenteExpress_App' }
  });

  if (!response.data || response.data.length === 0) return null;

  const first = response.data[0];
  const lat = first.lat;
  const lon = first.lon;
  if (!lat || !lon) return null;

  return {
    lat: String(lat),
    lon: String(lon),
    formattedAddress: formatAddressFromNominatim(first),
  };
}
