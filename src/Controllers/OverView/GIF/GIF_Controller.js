

import mongoose from "mongoose";
import { Gif }         from "../../../Models/Gif/Gif_Model.js";
import { ApiError }    from "../../../Utils/API_Errors.js";
import { ApiResponse } from "../../../Utils/API_Response.js";
import { asyncHandler } from "../../../Utils/Async_Handler.js";
import {
  getStaticThumbnailFilePath,
  getThumbnailLocalPath,
  getStaticCommentGifFilePath,
  getCommentGifLocalPath,
  getMongoosePaginationOptions,
} from "../../../Utils/Helpers.js";


const addGif = asyncHandler(async (req, res) => {
  const { fileType } = req.body;
  if (req.files) {
    try {
      const gifs =
        req.files.gif && req.files.gif.length
          ? req.files.gif.map((gf) => {
              const gfUrl = getStaticCommentGifFilePath(req, gf.filename);
              const gfLocalPath = getCommentGifLocalPath(gf.filename);
              return { url: gfUrl, localPath: gfLocalPath };
            })
          : [];
      console.log(`gif present`);
      const gif = await Gif.create({
        gifs: gifs,
        fileType: fileType,
      });

      console.log("gif file added successfully:", gif);

      return res
        .status(201)
        .json(new ApiResponse(201, gif, "gif added successfully"));
    } catch (error) {
      console.log(`error ${error}`);
    }
  } else {
    console.log("No gif file found in the upload uri");
  }
});

const getGif = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const gifAggregation = Gif.aggregate([
    { $sort: { createdAt: -1 } }, // Sort documents based on createdAt field in descending order
  ]);

  const gifs = await Gif.aggregatePaginate(
    gifAggregation,
    getMongoosePaginationOptions({
      page,
      limit,
      customLabels: {
        totalDocs: "totalGif",
        docs: "gifs",
      },
    })
  );

  console.log(`gifs: ${JSON.stringify(gifs, null, 2)}`);
  return res
    .status(200)
    .json(new ApiResponse(200, gifs, "gifs fetched successfully"));
});

export { addGif, getGif };
