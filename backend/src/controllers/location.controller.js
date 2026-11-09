import { lookupIndianPincode } from "../services/location.service.js";
import { asyncHandler } from "../utils/async-handler.js";

export const lookupPincode = asyncHandler(async (request, response) => {
  const location = await lookupIndianPincode(request.params.pincode);
  response.status(200).json({ success: true, data: { location } });
});
