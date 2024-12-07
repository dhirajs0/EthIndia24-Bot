import redis from "redis";

const redisClient = redis.createClient();

export const connectRedis = async () => {
  try {
    redisClient.on("error", (err) => {
      console.error("Error connecting to Redis:", err);
    });
    await redisClient.connect();
    console.log("Connected to Redis successfully.");
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
  }
};

export const saveAuthToken = async (key, value) => {
  await redisClient.set(key, value);
};

export const getAuthToken = async (key) => {
  return await redisClient.get(key);
};

export default redisClient;
