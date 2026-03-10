import { BusinessProfile } from "../../../models/apps/business/business.profile.model.js";
import { validationResult } from "express-validator";
import {
  getStaticBusinessBackgroundImagePath,
  getBusinessBackgroundImageLocalPath,
  getStaticBusinessBackgroundVideoPath,
  getStaticVideoThumbnailPath,
} from "../../../utils/helpers.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { BusinessCatalogue } from "../../../models/apps/business/business.catalogue.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";

// Create or update a user's business profile
export const upsertBusinessProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const userId = req.user.id;
    const existingProfile = await BusinessProfile.findOne({ owner: userId });

    if (existingProfile) {
      // Update existing profile
      const updatedProfile = await BusinessProfile.findOneAndUpdate(
        { owner: userId },
        req.body,
        { new: true, runValidators: true }
      );
      return res.status(200).json({
        message: "Business profile updated successfully",
        business: updatedProfile,
      });
    } else {
      // Create new profile
      const business = new BusinessProfile({ ...req.body, owner: userId });
      await business.save();

      // Create the business catalogue and associate it with the business profile
      const businessCatalogue = new BusinessCatalogue({
        owner: userId,
        businessProfile: business._id,
        products: [],
      });
      await businessCatalogue.save();

      return res
        .status(201)
        .json({ message: "Business profile created successfully", business });
    }
  } catch (error) {
    res.status(500).json({ error: "Error saving business profile" });
  }
};

export const updateBusinessBackgroundImage = asyncHandler(async (req, res) => {
  // Check if user has uploaded a background image
  console.log("background handler");

  if (!req.file?.filename) {
    throw new ApiError(400, "Background image is required");
  }

  // Get background image file system URL and local path
  const backgroundImageUrl = getStaticBusinessBackgroundImagePath(
    req,
    req.file?.filename
  );
  const backgroundImageLocalPath = getBusinessBackgroundImageLocalPath(
    req.file?.filename
  );

  // Find the user's business profile
  const businessProfile = await BusinessProfile.findOne({
    owner: req.user._id,
  });
  if (!businessProfile) {
    throw new ApiError(404, "Business profile not found");
  }

  // Update the business profile with the new background image
  const updatedBusinessProfile = await BusinessProfile.findByIdAndUpdate(
    businessProfile._id,
    {
      $set: {
        backgroundPhoto: {
          url: backgroundImageUrl,
        },
      },
    },
    { new: true }
  );

  // Remove the old background image if it exists
  if (businessProfile.backgroundPhoto?.localPath) {
    removeLocalFile(businessProfile.backgroundPhoto.localPath);
  }

  // Respond with the updated business profile
  return res.status(200).json({
    message: "Background image updated successfully",
    updatedBusinessProfile,
  });
});

export const updateBusinessBackgroundVideo = asyncHandler(async (req, res) => {
  // Check if user has uploaded a background video

  // Debugging: Log the incoming files
  // console.log("Received files:", req.files);

  // Check if user has uploaded a video and a thumbnail
  if (!req.files?.b_vid || !req.files?.b_thumb) {
    throw new ApiError(400, "Background video and thumbnail are required");
  }

  // Get video and thumbnail file paths
  const videoUrl = getStaticBusinessBackgroundVideoPath(
    req,
    req.files.b_vid[0].filename
  );
  const thumbnailUrl = getStaticVideoThumbnailPath(
    req,
    req.files.b_thumb[0].filename
  );

  // Find the user's business profile
  const businessProfile = await BusinessProfile.findOne({
    owner: req.user._id,
  });
  if (!businessProfile) {
    throw new ApiError(404, "Business profile not found");
  }

  // Update the business profile with the new background image
  const updatedBusinessProfile = await BusinessProfile.findByIdAndUpdate(
    businessProfile._id,
    {
      $set: {
        backgroundVideo: {
          url: videoUrl,
          thumbnail: thumbnailUrl,
        },
      },
    },
    { new: true }
  );

  // Respond with the updated business profile
  return res.status(200).json({
    message: "Background video updated successfully",
    updatedBusinessProfile,
  });
});

export const businessLocationInfo = asyncHandler(async (req, res) => {
    //get request data from user
    console.log("Raw body\n", req.body);
    
  const {enabled, latitude, longitude, accuracy, range} = req.body;

  try {
  if (!enabled || !latitude || !longitude || !accuracy || !range) {
    throw new ApiError(
      400,
      "enabled, latitude, longitude, accuracy, range text are required"
    );
  }

  // Find the user's business profile
  const businessProfile = await BusinessProfile.findOne({
    owner: req.user._id,
  });

  if (!businessProfile) {
    throw new ApiError(404, "Business profile not found");
  }

  const updatedBusinessLocationInfo = await BusinessProfile.findByIdAndUpdate(
    businessProfile._id,
    {
      $set: {
        "location.businessLocation": {
          enabled: enabled,
          locationInfo: {
              latitude: latitude,
              longitude: longitude,
              accuracy: accuracy,
              range: range
          }
        }
      }
    },
    {upsert: true, new: true}
  );

  // Respond with the updated business profile
  console.log("Business Location Info", updatedBusinessLocationInfo.location.businessLocation)
  
  return res.status(200).json({
    message: "BusinessLocationInfo text updated successfully",
    updatedBusinessLocationInfo,
  });
    
  } catch (error) {
    console.log("Something went wrong", error);
    
  }
});

export const updateLiveLocationInfo = asyncHandler(async (req, res) => {

  console.log("Raw body", req.body);
  
  // Check if text is provided
  const {enabled, latitude, longitude, accuracy, range } = req.body;
  if (!enabled || !latitude || !longitude || !accuracy || !range) {
    throw new ApiError(
      400,
      "enable, latitude, longitude, accuracy, range text are required"
    );
  }

  // Find the user's business profile
  const businessProfile = await BusinessProfile.findOne({
    owner: req.user._id,
  });
  if (!businessProfile) {
    throw new ApiError(404, "Business profile not found");
  }

  // Update the business profile with the new background text
  const updatedBusinessProfile = await BusinessProfile.findByIdAndUpdate(
    businessProfile._id,
    {
      $set: {
        "location.walkingBillboard": {
          enabled: enabled,
          liveLocationInfo: {
            latitude: latitude,
            longitude: longitude,
            accuracy: accuracy,
            range: range
          }
          
                
        }
      },
    },
    { upsert: true, new: true }
  );

  
  console.log("Live Location info", updatedBusinessProfile.location.walkingBillboard);

  // Respond with the updated business profile
  return res.status(200).json({
    message: "liveLocationInfo text updated successfully",
    updatedBusinessProfile,
  });
});

// Get the authenticated user's business profile
export const getOwnBusinessProfile = async (req, res) => {
  const userId = req.user.id;
  try {
    const business = await BusinessProfile.findOne({ owner: userId });
    if (!business) {
      return res.status(404).json({ error: "Business profile not found" });
    }
    res.status(200).json(business);
  } catch (error) {
    res.status(500).json({ error: "Error fetching business profile" });
  }
};

// Get another user's business profile by ID
export const getBusinessProfileById = async (req, res) => {
  const { id } = req.params;
  try {
    const business = await BusinessProfile.findOne({ owner: id });
    if (!business) {
      return res.status(404).json({ error: "Business profile not found" });
    }
    res.status(200).json(business);
  } catch (error) {
    res.status(500).json({ error: "Error fetching business profile" });
  }
};
