import { logEvent }    from "../../../Services/Recommendation_System_Service.js";
import { ApiError }    from "../../../Utils/API_Errors.js";
import { ApiResponse } from "../../../Utils/API_Response.js";
import { asyncHandler } from "../../../Utils/Async_Handler.js";

const VALID_ITEM_TYPES = ["post", "shot", "product", "user"];
const VALID_EVENT_TYPES = ["view", "like", "comment", "share", "replay",
    "purchase_intent", "profile_view", "follow", "impression"];

export const uploadEvents = asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id;

        const {
            itemId, itemType, eventType,
            durationMs, completionRate, replayCount,
            source, positionInFeed, sessionId,
            deviceType, recSource,
            isNegativeFeedback, negativeFeedbackReason,
            ledToFollow, ledToProfileView, ledToPurchaseIntent,
        } = req.body;

        if (!itemId || !itemType || !eventType) {
            return res.status(400).json(new ApiError(400, "itemId, itemType and eventType are required"));
        }

        if (!VALID_ITEM_TYPES.includes(itemType)) {
            return res.status(400).json(new ApiError(400, `itemType must be one of: ${VALID_ITEM_TYPES.join(", ")}`));
        }

        if (!VALID_EVENT_TYPES.includes(eventType)) {
            return res.status(400).json(new ApiError(400, `eventType must be one of: ${VALID_EVENT_TYPES.join(", ")}`));
        }

        // Fire and forget — never block the response for logging
        logEvent({
            userId, itemId, itemType, eventType,
            durationMs, completionRate, replayCount,
            source, positionInFeed, sessionId,
            deviceType: deviceType || "android",
            recSource,
            isNegativeFeedback: isNegativeFeedback || false,
            negativeFeedbackReason,
            ledToFollow: ledToFollow || false,
            ledToProfileView: ledToProfileView || false,
            ledToPurchaseIntent: ledToPurchaseIntent || false,
        });

        return res.status(200).json(
            new ApiResponse(
                200,
                null,
                "Event logged"
            )
        );
    } catch (error) {
        console.log("Something went wrong", error);
        return;
    }

});

// Batch logging — useful when app is offline and queues events
export const uploadBatchedEvents = asyncHandler(async (req, res) => {
    try {
        const userId = req.user._id;
        const { events } = req.body;

        if (!Array.isArray(events) || !events.length) {
            return res.status(400).json(new ApiError(400, "events must be a non-empty array"));
        }

        // Fire and forget all at once
        events.forEach((event) => {
            logEvent({
                ...event,
                userId,
                deviceType: event.deviceType || "android",
                isNegativeFeedback: event.isNegativeFeedback || false,
                ledToFollow: event.ledToFollow || false,
                ledToProfileView: event.ledToProfileView || false,
                ledToPurchaseIntent: event.ledToPurchaseIntent || false,
            });
        });

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    received: events.length
                },
                "Batch logged"
            )
        );

    } catch (error) {
        console.log("Somethign went wrong", error);
        return;
    }

});
