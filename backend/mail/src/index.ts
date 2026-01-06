dotenv.config();
import express from "express";
import dotenv from "dotenv";
import { startSendOptConsumer } from "./consumer.js";


const PORT = process.env.PORT;
const app = express();

startSendOptConsumer();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
})
