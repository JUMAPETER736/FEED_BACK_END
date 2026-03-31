
import { ApiResponse }  from "../../Utils/API_Response.js";
import { asyncHandler } from "../../Utils/Async_Handler.js";

const getCookies = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, { cookies: req.cookies }, "Cookies returned"));
});

const setCookie = asyncHandler(async (req, res) => {
  const cookieObject = req.body;

  Object.entries(cookieObject).forEach((entry) => {
    res.cookie(...entry);
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { cookies: { ...req.cookies, ...cookieObject } },
        "Cookie has been set"
      )
    );
});

const removeCookie = asyncHandler(async (req, res) => {
  const { cookieKey } = req.query;

  return res
    .status(200)
    .clearCookie(cookieKey)
    .json(
      new ApiResponse(
        200,
        { cookies: { ...req.cookies, [cookieKey]: undefined } },
        "Cookie has been cleared"
      )
    );
});

export { getCookies, setCookie, removeCookie };
