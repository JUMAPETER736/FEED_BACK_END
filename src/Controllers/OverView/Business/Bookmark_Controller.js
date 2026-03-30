

import { BusinessProduct } from "../../../../Models/OverView/Business/Business_Product_Model.js";
import { BusinessBookmark } from "../../../../Models/OverView/Business/Business_Bookmark_Post_Model.js";
import { ApiError } from "../../../../Utils/API_Error.js";
import { ApiResponse } from "../../../../Utils/API_Response.js";
import { asyncHandler } from "../../../../Utils/Async_Handler.js";

export const bookmarkUnBookmarkBusinessPost = asyncHandler(async (req, res) => {

    try {
        const { businessPostId } = req.params;

        const userId = req.user?._id;

        const businessPost = await BusinessProduct.findById(businessPostId);
        // Check for post existence
        if (!businessPost) {
            return res.status(404).json(
                404,
                {
                    success: false,
                },
                "Business Post does not exists"
            );
        }

        const isAlreadyBookmarked = await BusinessBookmark.findOne({
            postId: businessPost._id,
            bookmarkedBy: userId
        });

        if (isAlreadyBookmarked) {
            // if already bookmarked, dislike it by removing the record from the DB
            await BusinessBookmark.findOneAndDelete({
                postId: businessPost._id,
                bookmarkedBy: userId
            });

            return res.status(200).json(
                new ApiResponse(
                    200,
                    {
                        isBookmarked: false,
                    },
                    "Bookmark removed successfully"
                )
            );
        } else {
            // if not bookmarked, like it by adding the record from the DB
            await BusinessBookmark.create({
                postId: businessPost._id,
                bookmarkedBy: userId
            });

            return res.status(200).json(
                new ApiResponse(
                    200,
                    {
                        isBookmarked: true,
                    },
                    "Feed Bookmarked successfully"
                )
            );
        }
    } catch (error) {
        console.log("Something went wrong", error);
        return;
    }
});

export const getBookmarks = asyncHandler(async (req, res) => {

    const allBookmarks = await BusinessBookmark.find({});

    res.status(200).json({
        success: true,
        data: allBookmarks
    })
});