import {jwtDecode} from "jwt-decode";

interface JwtPayload {
  exp: number; // expiration time in seconds
  [key: string]: any;
}

export const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error("Authentication token not found.");
    return null;
  }

  try {
    const decoded = jwtDecode<JwtPayload>(token);
    const now = Math.floor(Date.now() / 1000);

    if (decoded.exp < now) {
      console.warn("JWT token has expired.");
      localStorage.removeItem('token');
      return null;
    }

    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    };
  } catch (err) {
    console.error("Invalid JWT token:", err);
    localStorage.removeItem('token');
    return null;
  }
};
