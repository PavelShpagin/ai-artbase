export const BASE_URL = "http://127.0.0.1:8001";

const fetchAPI = async (
  endpoint,
  method = "GET",
  body = null,
  headers = {},
  as_json = true
) => {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method: method,
    headers: {
      ...headers,
    },
    body: body,
  };

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "An error occurred");
  }
  if (as_json) {
    return await response.json();
  } else {
    return response;
  }
};

export default fetchAPI;
