import { ApiResponse }  from "../Utils/API_Response.js";
import { asyncHandler } from "../Utils/Async_Handler.js";


const healthcheck = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, "OK", "Health check passed"));
});

export { healthcheck };
