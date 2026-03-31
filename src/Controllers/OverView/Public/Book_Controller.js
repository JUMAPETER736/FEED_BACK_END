import booksJson from "../../json/books.json" assert { type: "json" };
import { ApiError }    from "../../Utils/API_Errors.js";
import { ApiResponse } from "../../Utils/API_Response.js";
import { asyncHandler } from "../../Utils/Async_Handler.js";
import { filterObjectKeys, getPaginatedPayload } from "../../Utils/Helpers.js";

const getBooks = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  let booksArray = query
    ? structuredClone(booksJson).filter((book) => {
        return (
          book.searchInfo?.textSnippet.toLowerCase().includes(query) ||
          book.volumeInfo.title?.includes(query) ||
          book.volumeInfo.subtitle?.includes(query)
        );
      })
    : structuredClone(booksJson);

  if (inc && inc[0]?.trim()) {
    booksArray = filterObjectKeys(inc, booksArray);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        getPaginatedPayload(booksArray, page, limit),
        "Books fetched successfully"
      )
    );
});

const getBookById = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const book = booksJson.find((book) => +book.id === +bookId);
  if (!book) {
    throw new ApiError(404, "Book does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, book, "Book fetched successfully"));
});

const getARandomBook = asyncHandler(async (req, res) => {
  const booksArray = booksJson;
  const randomIndex = Math.floor(Math.random() * booksArray.length);

  return res
    .status(200)
    .json(
      new ApiResponse(200, booksArray[randomIndex], "Book fetched successfully")
    );
});

export { getBooks, getARandomBook, getBookById };
