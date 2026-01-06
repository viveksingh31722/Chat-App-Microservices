import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

const {
  CLOUD_NAME,
  API_KEY,
  API_SECRET
} = process.env;

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  throw new Error("Missing Cloudinary environment variables");
}

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: API_KEY,
  api_secret: API_SECRET,
});


export default cloudinary;