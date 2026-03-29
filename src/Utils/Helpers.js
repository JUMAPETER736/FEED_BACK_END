import fs from "fs";
import mongoose from "mongoose";


export const filterObjectKeys = (fieldsArray, objectArray) => {
  const filteredArray = structuredClone(objectArray).map((originalObj) => {
    let obj = {};
    structuredClone(fieldsArray)?.forEach((field) => {
      if (field?.trim() in originalObj) {
        obj[field] = originalObj[field];
      }
    });
    if (Object.keys(obj).length > 0) return obj;
    return originalObj;
  });
  return filteredArray;
};

/**
 *
 * @param {any[]} dataArray
 * @param {number} page
 * @param {number} limit
 * @returns {{previousPage: string | null, currentPage: string, nextPage: string | null, data: any[]}}
 */
export const getPaginatedPayload = (dataArray, page, limit) => {
  const startPosition = +(page - 1) * limit;

  const totalItems = dataArray.length; // total documents present after applying search query
  const totalPages = Math.ceil(totalItems / limit);

  dataArray = structuredClone(dataArray).slice(
    startPosition,
    startPosition + limit
  );

  const payload = {
    page,
    limit,
    totalPages,
    previousPage: page > 1,
    nextPage: page < totalPages,
    totalItems,
    currentPageItems: dataArray?.length,
    data: dataArray,
  };
  return payload;
};

/**
 *
 * @param {import("express").Request} req
 * @param {string} fileName
 * @description returns the file's static path from where the server is serving the static image
 */
export const getStaticFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/images/${fileName}`;
};
export const getStaticAvatarFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/profileimages/${fileName}`;
};

export const getStaticThumbnailFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/thumbnail/${fileName}`;
};

export const getStaticBusinessBackgroundImagePath = (req, filename) => {
  return `${req.protocol}://${req.get("host")}/business/background/${filename}`;
};

export const getStaticBusinessBackgroundVideoPath = (req, filename) => {
  return `${req.protocol}://${req.get("host")}/business/v/${filename}`;
};

export const getStaticVideoThumbnailPath = (req, filename) => {
  return `${req.protocol}://${req.get("host")}/business/t/${filename}`;
};

export const getStaticBusinessProductImagePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/business/products/${fileName}`;
};

// for short comment files
export const getStaticCommentImageFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/commentimages/${fileName}`;
};

export const getStaticFeedCommentImageFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/feedcommentimages/${fileName}`;
};

export const getStaticCommentThumbnailFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/commentthumbnail/${fileName}`;
};

export const getStaticFeedCommentThumbnailFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get(
    "host"
  )}/feedcommentthumbnail/${fileName}`;
};

export const getStaticCommentVideoFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/commentvideos/${fileName}`;
};

export const getStaticFeedCommentVideoFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/feedcommentvideos/${fileName}`;
};

export const getStaticCommentAudioFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/commentaudios/${fileName}`;
};

export const getStaticFeedCommentAudioFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/feedcommentaudios/${fileName}`;
};

export const getStaticCommentGifFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/commentgifs/${fileName}`;
};

export const getStaticFeedCommentGifFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/feedcommentgifs/${fileName}`;
};

export const getStaticCommentDocsFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/commentdocs/${fileName}`;
};

export const getStaticFeedCommentDocsFilePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/feedcommentdocs/${fileName}`;
};
//end of comments files

//for feed
export const getStaticFeedImagePath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/feed_images/${fileName}`;
};

export const getStaticMixedFilesFeedPath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/feed_mixed_files/${fileName}`;
};

export const getStaticFeedMultipleImagePath = (req, fileName) => {
  return `${req.protocol}://${req.get(
    "host"
  )}/feed_multiple_images/${fileName}`;
};

export const getStaticFeedAudioPath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/feed_audio/${fileName}`;
};
export const getStaticFeedVideoPath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/feed_video/${fileName}`;
};
export const getStaticFeedThumbnailPath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/feed_thumbnail/${fileName}`;
};

export const getStaticFeedDocsPath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/feed_docs/${fileName}`;
};
export const getStaticFeedVnPath = (req, fileName) => {
  return `${req.protocol}://${req.get("host")}/feed_vn/${fileName}`;
};
/**
 *
 * @param {string} fileName
 * @description returns the file's local path in the file system to assist future removal
 */

//for feed
export const getFeedDocsLocalPath = (fileName) => {
  return `public/feed_docs/${fileName}`;
};
export const getFeedVnLocalPath = (fileName) => {
  return `public/feed_vn/${fileName}`;
};
export const getFeedImageLocalPath = (fileName) => {
  return `public/feed_images/${fileName}`;
};

export const getMixedFilesFeedImageLocalPath = (fileName) => {
  return `public/feed_mixed_files/${fileName}`;
};

export const getFeedMultipleImageLocalPath = (fileName) => {
  return `public/feed_images/${fileName}`;
};

export const getFeedAudioLocalPath = (fileName) => {
  return `public/feed_multiple_images/${fileName}`;
};

export const getFeedVideoLocalPath = (fileName) => {
  return `public/feed_video/${fileName}`;
};

export const getFeedThumbnailLocalPath = (fileName) => {
  return `public/feed_thumbnail/${fileName}`;
};
//for comments
export const getCommentImageLocalPath = (fileName) => {
  return `public/commentimages/${fileName}`;
};

export const getFeedCommentImageLocalPath = (fileName) => {
  return `public/feedcommentimages/${fileName}`;
};

export const getCommentThumbnailLocalPath = (fileName) => {
  return `public/commentthumbnail/${fileName}`;
};

export const getFeedCommentThumbnailLocalPath = (fileName) => {
  return `public/feedcommentthumbnail/${fileName}`;
};

export const getCommentVideoLocalPath = (fileName) => {
  return `public/commentvideos/${fileName}`;
};

export const getFeedCommentVideoLocalPath = (fileName) => {
  return `public/feedcommentvideos/${fileName}`;
};

export const getCommentAudioLocalPath = (fileName) => {
  return `public/commentaudios/${fileName}`;
};

export const getFeedCommentAudioLocalPath = (fileName) => {
  return `public/feedcommentaudios/${fileName}`;
};

export const getCommentGifLocalPath = (fileName) => {
  return `public/commentgifs/${fileName}`;
};

export const getFeedCommentGifLocalPath = (fileName) => {
  return `public/feedcommentgifs/${fileName}`;
};

export const getCommentDocsLocalPath = (fileName) => {
  return `public/commentdocs/${fileName}`;
};

export const getFeedCommentDocsLocalPath = (fileName) => {
  return `public/feedcommentdocs/${fileName}`;
};
//end of comments files
export const getLocalPath = (fileName) => {
  return `public/images/${fileName}`;
};
export const getAvatarLocalPath = (fileName) => {
  return `public/profileimages/${fileName}`;
};
export const getThumbnailLocalPath = (fileName) => {
  return `public/thumbnail/${fileName}`;
};

export const getBusinessBackgroundImageLocalPath = (fileName) => {
  return `public/business/background/${fileName}`;
};

/**
 *
 * @param {string} localPath
 * @description Removed the local file from the local file system based on the file path
 */
export const removeLocalFile = (localPath) => {
  fs.unlink(localPath, (err) => {
    if (err) console.log("Error while removing local files: ", err);
    else {
      console.log("Removed local: ", localPath);
    }
  });
};

/**
 * @param {import("express").Request} req
 * @description **This utility function is responsible for removing unused image files due to the api fail**.
 *
 * **For example:**
 * * This can occur when product is created.
 * * In product creation process the images are getting uploaded before product gets created.
 * * Once images are uploaded and if there is an error creating a product, the uploaded images are unused.
 * * In such case, this function will remove those unused images.
 */
export const removeUnusedMulterImageFilesOnError = (req) => {
  try {
    const multerFile = req.file;
    const multerFiles = req.files;

    if (multerFile) {
      // If there is file uploaded and there is validation error
      // We want to remove that file
      removeLocalFile(multerFile.path);
    }

    if (multerFiles) {
      /** @type {Express.Multer.File[][]}  */
      const filesValueArray = Object.values(multerFiles);
      // If there are multiple files uploaded for more than one fields
      // We want to remove those files as well
      filesValueArray.map((fileFields) => {
        fileFields.map((fileObject) => {
          removeLocalFile(fileObject.path);
        });
      });
    }
  } catch (error) {
    // fail silently
    console.log("Error while removing image files: ", error);
  }
};

/**
 *
 * @param {{page: number; limit: number; customLabels: mongoose.CustomLabels;}} options
 * @returns {mongoose.PaginateOptions}
 */
export const getMongoosePaginationOptions = ({
  page = 1,
  limit = 10,
  customLabels,
}) => {
  return {
    page: Math.max(page, 1),
    limit: Math.max(limit, 1),
    pagination: true,
    customLabels: {
      pagingCounter: "serialNumberStartFrom",
      ...customLabels,
    },
  };
};

/**
 * @param {number} max Ceil threshold (exclusive)
 */
export const getRandomNumber = (max) => {
  return Math.floor(Math.random() * max);
};
