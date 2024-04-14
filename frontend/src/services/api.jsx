export const BASE_URL = "http://127.0.0.1:8001";

//experimental
const fetchAPI = async (
  endpoint,
  method = "GET",
  payload = null,
  headers = {}
) => {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {},
  };

  if (payload instanceof FormData) {
    options.body = payload;
  } else if (payload && method === "POST") {
    options.body = JSON.stringify(payload);
    options.headers["Content-Type"] = "application/json";
  }

  Object.keys(headers).forEach((key) => {
    options.headers[key] = headers[key];
  });

  try {
    const response = await fetch(url, options);
    if (!response.ok)
      throw new Error(
        `Network response was not ok, status: ${response.status}`
      );
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch:", error);
    throw error;
  }
};

export default fetchAPI;
