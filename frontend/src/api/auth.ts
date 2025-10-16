import { jwtDecode } from "jwt-decode";

interface JwtPayload {
  exp: number;
  [key: string]: any;
}

/**
 * Retrieves the Authorization header with a valid JWT token.
 * - Checks if a token exists in localStorage.
 * - Decodes and verifies expiration.
 * - Returns null if token is missing, invalid, or expired.
 */
export const getAuthHeader = () => {
  const token = localStorage.getItem("token");

  // 🔒 No token found
  if (!token) {
    console.error("Authentication token not found.");
    return null;
  }

  try {
    // 🔍 Decode token and validate expiration
    const decoded = jwtDecode<JwtPayload>(token);
    const now = Math.floor(Date.now() / 1000);

    if (decoded.exp < now) {
      console.warn("JWT token has expired.");
      localStorage.removeItem("token");
      return null;
    }

    // ✅ Valid token, return header config
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
  } catch (error) {
    console.error("Invalid JWT token:", error);
    localStorage.removeItem("token");
    return null;
  }
};
