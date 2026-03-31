


import { ApiResponse }  from "../../Utils/API_Response.js";
import { asyncHandler } from "../../Utils/Async_Handler.js";

const redirectToTheUrl = asyncHandler(async (req, res) => {
  const { url } = req.query;

  return res.status(301).redirect(url);
});

export { redirectToTheUrl };
