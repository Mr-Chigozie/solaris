import type { SolarResource } from '../types';

/**
 * Solar resource by Nigerian state (36 states + FCT), keyed to the state capital.
 *
 * IMPORTANT — DATA STATUS: these are APPROXIMATE development values for annual mean
 * and worst-month daily global horizontal irradiation (kWh/m²/day ≈ peak sun hours),
 * reflecting the well-known north–south gradient (≈4.2 on the coast to ≈6.2 in the
 * far north). They are NOT a validated dataset.
 *
 * Before commercial launch, replace them with per-coordinate extracts from NASA POWER
 * (monthly ALLSKY_SFC_SW_DWN) or the Global Solar Atlas, record the source and
 * extraction date, and bump SOLAR_DATA_VERSION. Every saved design stores the data
 * version, so older quotations remain reproducible.
 */
export const SOLAR_DATA_VERSION = 'ng-states-approx-2026.11';

export const SOLAR_DATA_SOURCE =
  'Approximate state-capital irradiation values for development. Pending replacement with NASA POWER / Global Solar Atlas extracts.';

export const NIGERIA_STATES: readonly SolarResource[] = [
  // North Central
  { state: 'Federal Capital Territory', stateCode: 'FC', capital: 'Abuja', zone: 'NORTH_CENTRAL', latitude: 9.0765, longitude: 7.3986, pshAnnual: 5.5, pshWorstMonth: 4.4 },
  { state: 'Benue', stateCode: 'BE', capital: 'Makurdi', zone: 'NORTH_CENTRAL', latitude: 7.7322, longitude: 8.5391, pshAnnual: 5.2, pshWorstMonth: 4.2 },
  { state: 'Kogi', stateCode: 'KO', capital: 'Lokoja', zone: 'NORTH_CENTRAL', latitude: 7.8023, longitude: 6.7333, pshAnnual: 5.2, pshWorstMonth: 4.1 },
  { state: 'Kwara', stateCode: 'KW', capital: 'Ilorin', zone: 'NORTH_CENTRAL', latitude: 8.4966, longitude: 4.5426, pshAnnual: 5.3, pshWorstMonth: 4.1 },
  { state: 'Nasarawa', stateCode: 'NA', capital: 'Lafia', zone: 'NORTH_CENTRAL', latitude: 8.4939, longitude: 8.5153, pshAnnual: 5.4, pshWorstMonth: 4.3 },
  { state: 'Niger', stateCode: 'NI', capital: 'Minna', zone: 'NORTH_CENTRAL', latitude: 9.6139, longitude: 6.5569, pshAnnual: 5.6, pshWorstMonth: 4.5 },
  { state: 'Plateau', stateCode: 'PL', capital: 'Jos', zone: 'NORTH_CENTRAL', latitude: 9.8965, longitude: 8.8583, pshAnnual: 5.6, pshWorstMonth: 4.4 },

  // North East
  { state: 'Adamawa', stateCode: 'AD', capital: 'Yola', zone: 'NORTH_EAST', latitude: 9.2035, longitude: 12.4954, pshAnnual: 5.7, pshWorstMonth: 4.7 },
  { state: 'Bauchi', stateCode: 'BA', capital: 'Bauchi', zone: 'NORTH_EAST', latitude: 10.3158, longitude: 9.8442, pshAnnual: 5.8, pshWorstMonth: 4.8 },
  { state: 'Borno', stateCode: 'BO', capital: 'Maiduguri', zone: 'NORTH_EAST', latitude: 11.8333, longitude: 13.15, pshAnnual: 6.1, pshWorstMonth: 5.1 },
  { state: 'Gombe', stateCode: 'GO', capital: 'Gombe', zone: 'NORTH_EAST', latitude: 10.2897, longitude: 11.1673, pshAnnual: 5.8, pshWorstMonth: 4.8 },
  { state: 'Taraba', stateCode: 'TA', capital: 'Jalingo', zone: 'NORTH_EAST', latitude: 8.8937, longitude: 11.3596, pshAnnual: 5.5, pshWorstMonth: 4.5 },
  { state: 'Yobe', stateCode: 'YO', capital: 'Damaturu', zone: 'NORTH_EAST', latitude: 11.7470, longitude: 11.9608, pshAnnual: 6.0, pshWorstMonth: 5.0 },

  // North West
  { state: 'Jigawa', stateCode: 'JI', capital: 'Dutse', zone: 'NORTH_WEST', latitude: 11.7564, longitude: 9.3389, pshAnnual: 6.0, pshWorstMonth: 5.0 },
  { state: 'Kaduna', stateCode: 'KD', capital: 'Kaduna', zone: 'NORTH_WEST', latitude: 10.5105, longitude: 7.4165, pshAnnual: 5.7, pshWorstMonth: 4.6 },
  { state: 'Kano', stateCode: 'KN', capital: 'Kano', zone: 'NORTH_WEST', latitude: 12.0022, longitude: 8.592, pshAnnual: 6.0, pshWorstMonth: 5.0 },
  { state: 'Katsina', stateCode: 'KT', capital: 'Katsina', zone: 'NORTH_WEST', latitude: 12.9908, longitude: 7.6018, pshAnnual: 6.1, pshWorstMonth: 5.1 },
  { state: 'Kebbi', stateCode: 'KE', capital: 'Birnin Kebbi', zone: 'NORTH_WEST', latitude: 12.4539, longitude: 4.1975, pshAnnual: 6.1, pshWorstMonth: 5.0 },
  { state: 'Sokoto', stateCode: 'SO', capital: 'Sokoto', zone: 'NORTH_WEST', latitude: 13.0059, longitude: 5.2476, pshAnnual: 6.2, pshWorstMonth: 5.1 },
  { state: 'Zamfara', stateCode: 'ZA', capital: 'Gusau', zone: 'NORTH_WEST', latitude: 12.1704, longitude: 6.6641, pshAnnual: 6.0, pshWorstMonth: 5.0 },

  // South East
  { state: 'Abia', stateCode: 'AB', capital: 'Umuahia', zone: 'SOUTH_EAST', latitude: 5.5249, longitude: 7.4942, pshAnnual: 4.6, pshWorstMonth: 3.6 },
  { state: 'Anambra', stateCode: 'AN', capital: 'Awka', zone: 'SOUTH_EAST', latitude: 6.2104, longitude: 7.0741, pshAnnual: 4.7, pshWorstMonth: 3.7 },
  { state: 'Ebonyi', stateCode: 'EB', capital: 'Abakaliki', zone: 'SOUTH_EAST', latitude: 6.3249, longitude: 8.1137, pshAnnual: 4.8, pshWorstMonth: 3.8 },
  { state: 'Enugu', stateCode: 'EN', capital: 'Enugu', zone: 'SOUTH_EAST', latitude: 6.4584, longitude: 7.5464, pshAnnual: 4.9, pshWorstMonth: 3.8 },
  { state: 'Imo', stateCode: 'IM', capital: 'Owerri', zone: 'SOUTH_EAST', latitude: 5.4836, longitude: 7.0333, pshAnnual: 4.6, pshWorstMonth: 3.6 },

  // South South
  { state: 'Akwa Ibom', stateCode: 'AK', capital: 'Uyo', zone: 'SOUTH_SOUTH', latitude: 5.0377, longitude: 7.9128, pshAnnual: 4.4, pshWorstMonth: 3.4 },
  { state: 'Bayelsa', stateCode: 'BY', capital: 'Yenagoa', zone: 'SOUTH_SOUTH', latitude: 4.9267, longitude: 6.2676, pshAnnual: 4.3, pshWorstMonth: 3.3 },
  { state: 'Cross River', stateCode: 'CR', capital: 'Calabar', zone: 'SOUTH_SOUTH', latitude: 4.9757, longitude: 8.3417, pshAnnual: 4.3, pshWorstMonth: 3.3 },
  { state: 'Delta', stateCode: 'DE', capital: 'Asaba', zone: 'SOUTH_SOUTH', latitude: 6.1985, longitude: 6.7319, pshAnnual: 4.6, pshWorstMonth: 3.6 },
  { state: 'Edo', stateCode: 'ED', capital: 'Benin City', zone: 'SOUTH_SOUTH', latitude: 6.335, longitude: 5.6037, pshAnnual: 4.6, pshWorstMonth: 3.6 },
  { state: 'Rivers', stateCode: 'RI', capital: 'Port Harcourt', zone: 'SOUTH_SOUTH', latitude: 4.8156, longitude: 7.0498, pshAnnual: 4.3, pshWorstMonth: 3.3 },

  // South West
  { state: 'Ekiti', stateCode: 'EK', capital: 'Ado-Ekiti', zone: 'SOUTH_WEST', latitude: 7.6233, longitude: 5.2209, pshAnnual: 4.9, pshWorstMonth: 3.8 },
  { state: 'Lagos', stateCode: 'LA', capital: 'Ikeja', zone: 'SOUTH_WEST', latitude: 6.6018, longitude: 3.3515, pshAnnual: 4.6, pshWorstMonth: 3.5 },
  { state: 'Ogun', stateCode: 'OG', capital: 'Abeokuta', zone: 'SOUTH_WEST', latitude: 7.1475, longitude: 3.3619, pshAnnual: 4.7, pshWorstMonth: 3.6 },
  { state: 'Ondo', stateCode: 'ON', capital: 'Akure', zone: 'SOUTH_WEST', latitude: 7.2571, longitude: 5.2058, pshAnnual: 4.8, pshWorstMonth: 3.7 },
  { state: 'Osun', stateCode: 'OS', capital: 'Osogbo', zone: 'SOUTH_WEST', latitude: 7.7827, longitude: 4.5418, pshAnnual: 4.9, pshWorstMonth: 3.8 },
  { state: 'Oyo', stateCode: 'OY', capital: 'Ibadan', zone: 'SOUTH_WEST', latitude: 7.3775, longitude: 3.947, pshAnnual: 4.9, pshWorstMonth: 3.8 },
];

/** National fallback when a location cannot be resolved (conservative, southern-leaning). */
export const NATIONAL_FALLBACK: SolarResource = {
  state: 'Nigeria (national fallback)',
  stateCode: 'NG',
  capital: '—',
  zone: 'NORTH_CENTRAL',
  latitude: 9.082,
  longitude: 8.6753,
  pshAnnual: 4.6,
  pshWorstMonth: 3.5,
};

const normalise = (value: string) =>
  value.toLowerCase().replace(/\bstate\b/g, '').replace(/[^a-z]/g, '');

const ALIASES: Record<string, string> = {
  fct: 'FC',
  abuja: 'FC',
  federalcapitalterritory: 'FC',
  crossriver: 'CR',
  akwaibom: 'AK',
};

/** Resolve a state by name, code or common alias (e.g. "FCT", "Abuja", "Lagos State"). */
export function findState(query: string): SolarResource | undefined {
  const key = normalise(query);
  if (!key) return undefined;
  const aliasCode = ALIASES[key];
  return NIGERIA_STATES.find(
    (s) =>
      s.stateCode.toLowerCase() === key ||
      s.stateCode === aliasCode ||
      normalise(s.state) === key,
  );
}
