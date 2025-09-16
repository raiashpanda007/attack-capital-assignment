import dotenv from "dotenv";
dotenv.config();

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

function validateConfig() {
  const required = {
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,

  };
  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  console.log("All required environment variables are set.");
}

export {
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET,
  validateConfig,
};