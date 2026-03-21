

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


/**
 * Helper function to convert degrees to radians
 * @param {number} degrees 
 * @returns {number} radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}


// getting user location and process the location for events
export const businesslocationAdvertisement = asyncHandler(async (req, res) => {

  try {
    const userId = req.user._id;

    const { latitude, longitude, accuracy } = req.body;
    if (!latitude || !longitude || !accuracy) {
      return res.status(400).json({
        success: false,
        message: "latitude, longitude, accuracy text are required"
      });
    }

    const userLocationInfo = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: Number(accuracy),
    }

    const profiles = await BusinessProfile.find({})
      .select("_id owner backgroundPhoto businessName businessDescription businessType location.businessLocation")
      .lean().populate("owner");

    if (profiles.length === 0) {
      return res.status(404).json({
        success: true,
        message: "Profiles not found"
      });
    }

    for (const profile of profiles) {
      //skipping any business profile if business location is not enabled
      if (!profile.location?.businessLocation.enabled) {
        continue;
      } else {

        // skip the business profile if owner is the user
        if (String(userId) === String(profile.owner?._id)) {
          continue;
        } else {
          // getting business location info
          const businessLocationInfo = {
            latitude: Number(profile.location?.businessLocation.locationInfo.latitude),
            longitude: Number(profile.location?.businessLocation.locationInfo.longitude),
            accuracy: Number(profile.location?.businessLocation.locationInfo.accuracy),
            range: Number(profile.location?.businessLocation.locationInfo.range)
          };

          const combinedAccuracy = userLocationInfo.accuracy + businessLocationInfo.accuracy;

          //check if combined accuracy is less than or equal to 20
          if (combinedAccuracy <= 20) {
            // calculate distance between the two locations
            let distance = calculateDistanceVincenty(
              userLocationInfo.latitude,
              userLocationInfo.longitude,
              businessLocationInfo.latitude,
              businessLocationInfo.longitude,
              "meters"
            );

            distance = Math.ceil(distance);

            // check if distance is within the business location range
            if (distance <= businessLocationInfo.range) {

              const products = await BusinessProduct.find({})
                .select("owner itemName")
                .lean();

              const businessProfileProducts = [];

              for (const product of products) {
                if (String(product.owner) === String(profile.owner?._id)) {
                  businessProfileProducts.push(product);
                  continue;
                } else {
                  continue;
                }
              }


              const user = {
                userId: String(profile.owner?._id),
                avatar: String(profile.owner?.avatar.url),
                username: String(profile.owner?.username)
              };

              const advertisment = {
                owner: user,
                businessId: String(profile._id),
                businessName: profile.businessName,
                businessDescription: profile.businessDescription,
                distance: String(distance),
                image: profile.backgroundPhoto,
                items: businessProfileProducts
              };

              //send an advertisement to the user about the business near by  
              console.log("Advertisement sent");
              emitSocketEvent(req, String(userId), "businessLocationAdvertisement", advertisment);
              continue;
            } else {
              //skipping the business profile if accuracy is greater than 20 meters
              continue;
            }
          }
        }

      }
    }

    return res.status(200).json({
      success: true,
      message: "Done processing business profiles"
    });

  } catch (error) {
    console.log("Something went wrong!!", error);
  }
});



export const walkingBillboardAdvertisement = asyncHandler(async (req, res) => {
  try {

    const { latitude, longitude, accuracy } = req.body;

    const userId = req.user._id;

    if (!latitude || !longitude || !accuracy) {
      return res.status(400).json({
        success: false,
        message: "latitude, longitude, accuracy required"
      });
    }

    const userLocationInfo = {
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: Number(accuracy)
    };

    const profiles = await BusinessProfile.find({})
      .select("_id owner backgroundPhoto businessName businessDescription businessType location.walkingBillboard contact.address")
      .lean().populate("owner");

    if (profiles.length === 0) {
      return res.status(404).json({
        success: true,
        message: "Profiles not found"
      });
    }