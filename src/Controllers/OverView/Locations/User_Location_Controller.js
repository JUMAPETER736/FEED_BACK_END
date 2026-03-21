

import { BusinessProfile } from "../../../models/apps/business/business.profile.model.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { emitSocketEvent } from "../../../socket/index.js";
import { BusinessProduct } from "../../../models/apps/business/business.product.model.js";

/**
 * Calculate distance using Vincenty formula - most accurate for long distances
 * @param {number} lat1 - First point latitude
 * @param {number} lon1 - First point longitude
 * @param {number} lat2 - Second point latitude
 * @param {number} lon2 - Second point longitude
 * @param {string} unit - 'km', 'miles', 'meters'
 * @returns {number} Distance in specified unit
 */
function calculateDistanceVincenty(lat1, lon1, lat2, lon2, unit = 'km') {
  // Validate inputs (same as Haversine)
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' || typeof lon2 !== 'number') {
    throw new Error('All coordinates must be numbers');
  }

  // Quick return for identical points
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const a = 6378137; // semi-major axis in meters
  const f = 1 / 298.257223563; // flattening
  const b = (1 - f) * a;

  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);

  const U1 = Math.atan((1 - f) * Math.tan(phi1));
  const U2 = Math.atan((1 - f) * Math.tan(phi2));
  const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

  let lambda = deltaLambda;
  let lambdaP = 2 * Math.PI;
  let iterLimit = 100;
  let cosSqAlpha, sinSigma, cos2SigmaM, cosSigma, sigma;

  while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0) {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);

    sinSigma = Math.sqrt((cosU2 * sinLambda) * (cosU2 * sinLambda) +
      (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) *
      (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda));

    if (sinSigma === 0) return 0;

    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);

    const sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
    cosSqAlpha = 1 - sinAlpha * sinAlpha;
    cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha;

    if (isNaN(cos2SigmaM)) cos2SigmaM = 0;

    const C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda = deltaLambda + (1 - C) * f * sinAlpha *
      (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma *
        (-1 + 2 * cos2SigmaM * cos2SigmaM)));
  }

  if (iterLimit === 0) return NaN;

  const uSq = cosSqAlpha * (a * a - b * b) / (b * b);
  const A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));

  const deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma *
    (-1 + 2 * cos2SigmaM * cos2SigmaM) - B / 6 * cos2SigmaM *
    (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));

  let distance = b * A * (sigma - deltaSigma); // meters

  // Convert to requested unit
  const conversions = {
    km: 0.001,
    kilometers: 0.001,
    miles: 0.000621371,
    mi: 0.000621371,
    meters: 1,
    m: 1,
    feet: 3.28084,
    ft: 3.28084
  };

  const conversion = conversions[unit.toLowerCase()];
  if (!conversion) {
    throw new Error('Supported units: km, miles, meters, feet');
  }

  return distance * conversion;
}


