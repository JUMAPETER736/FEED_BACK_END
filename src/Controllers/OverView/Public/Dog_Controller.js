import dogsJson from "../../json/dogs.json" assert { type: "json" };
import { ApiError }    from "../../Utils/API_Errors.js";
import { ApiResponse } from "../../Utils/API_Response.js";
import { asyncHandler } from "../../Utils/Async_Handler.js";
import { filterObjectKeys, getPaginatedPayload } from "../../Utils/Helpers.js";


const getDogs = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  let dogsArray = query
    ? structuredClone(dogsJson).filter((dog) => {
        return (
          dog.name?.toLowerCase().includes(query) ||
          dog.breed_group?.toLowerCase().includes(query)
        );
      })
    : structuredClone(dogsJson);

  if (inc && inc[0]?.trim()) {
    dogsArray = filterObjectKeys(inc, dogsArray);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        getPaginatedPayload(dogsArray, page, limit),
        "Dogs fetched successfully"
      )
    );
});

const getDogById = asyncHandler(async (req, res) => {
  const { dogId } = req.params;
  const dog = dogsJson.find((dog) => +dog.id === +dogId);
  if (!dog) {
    throw new ApiError(404, "Dog does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, dog, "Dog fetched successfully"));
});

const getARandomDog = asyncHandler(async (req, res) => {
  const dogsArray = dogsJson;
  const randomIndex = Math.floor(Math.random() * dogsArray.length);

  return res
    .status(200)
    .json(
      new ApiResponse(200, dogsArray[randomIndex], "Dog fetched successfully")
    );
});

export { getDogs, getARandomDog, getDogById };
