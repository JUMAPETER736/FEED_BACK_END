import mealsJson from "../../json/meals.json" assert { type: "json" };
import { ApiError }    from "../../Utils/API_Errors.js";
import { ApiResponse } from "../../Utils/API_Response.js";
import { asyncHandler } from "../../Utils/Async_Handler.js";
import { filterObjectKeys, getPaginatedPayload } from "../../Utils/Helpers.js";

const getMeals = asyncHandler(async (req, res) => {
  const page = +(req.query.page || 1);
  const limit = +(req.query.limit || 10);
  const query = req.query.query?.toLowerCase(); // search query
  const inc = req.query.inc?.split(","); // only include fields mentioned in this query

  let mealsArray = query
    ? structuredClone(mealsJson).filter((meal) => {
        return (
          meal.strMeal?.toLowerCase().includes(query) ||
          meal.strCategory?.includes(query)
        );
      })
    : structuredClone(mealsJson);

  if (inc && inc[0]?.trim()) {
    mealsArray = filterObjectKeys(inc, mealsArray);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        getPaginatedPayload(mealsArray, page, limit),
        "Meals fetched successfully"
      )
    );
});

const getMealById = asyncHandler(async (req, res) => {
  const { mealId } = req.params;
  const meal = mealsJson.find((meal) => +meal.id === +mealId);
  if (!meal) {
    throw new ApiError(404, "Meal does not exist.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, meal, "Meal fetched successfully"));
});

const getARandomMeal = asyncHandler(async (req, res) => {
  const mealsArray = mealsJson;
  const randomIndex = Math.floor(Math.random() * mealsArray.length);

  return res
    .status(200)
    .json(
      new ApiResponse(200, mealsArray[randomIndex], "Meal fetched successfully")
    );
});

export { getMeals, getARandomMeal, getMealById };
