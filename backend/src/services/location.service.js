import { AppError } from "../utils/app-error.js";

const removeOfficeSuffix = (name) => name.replace(/\s+(B\.?O\.?|S\.?O\.?|H\.?O\.?)$/i, "").trim();

export const lookupIndianPincode = async (pincode) => {
  let response;
  try {
    response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new AppError("PIN-code lookup is unavailable right now. Please enter the address manually.", 503);
  }

  if (!response.ok) {
    throw new AppError("PIN-code lookup is unavailable right now. Please enter the address manually.", 503);
  }

  const payload = await response.json();
  const postOffices = Array.isArray(payload) ? payload[0]?.PostOffice : null;
  if (!Array.isArray(postOffices) || postOffices.length === 0) {
    throw new AppError("We could not find a location for that PIN code.", 404);
  }

  const firstOffice = postOffices[0];
  const localities = [...new Set(postOffices.map((office) => removeOfficeSuffix(office.Name || "")).filter(Boolean))];

  return {
    pincode,
    city: firstOffice.District || "",
    state: firstOffice.State || "",
    localities,
  };
};
