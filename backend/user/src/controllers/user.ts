import { generateToken } from "../config/generateToken.js";
import { publishToQueue } from "../config/rabbitmq.js";
import TryCatch from "../config/tryCatch.js";
import { redisClient } from "../index.js";
import type { AuthenticatedRequest } from "../middleware/isAuth.js";
import { User } from "../model/user.js";

export const loginUser = TryCatch(async (req, res) => {
  const { email } = req.body;

  const rateLimitKey = `otp:rateLimit:${email}`;
  const rateLimit = await redisClient.get(rateLimitKey);

  if (rateLimit) {
    res
      .status(429)
      .json({ message: "Too many requests. Please try again later" });
    return;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  const otpKey = `otp:${email}`;
  await redisClient.set(otpKey, otp, { EX: 300 });

  await redisClient.set(rateLimitKey, "true", { EX: 60 });

  const message = {
    to: email,
    subject: "Your OTP Code",
    body: `Your OTP code is ${otp}. It is valid for 5 minutes`,
  };

  await publishToQueue("send-otp", message);
  res.status(200).json({ message: "OTP sent to your email" });
});

export const verifyUser = TryCatch(async (req, res) => {
  const { email, otp: enteredOtp } = req.body;

  if (!email || !enteredOtp) {
    res.status(400).json({ message: "Email and OTP are required" });
    return;
  }

  const otpKey = `otp:${email}`;
  const storedOtp = await redisClient.get(otpKey);

  if (!storedOtp || storedOtp !== enteredOtp) {
    res.status(400).json({ message: "Invalid or Expired OTP" });
    return;
  }

  await redisClient.del(otpKey);

  let user = await User.findOne({ email });

  if (!user) {
    const name = email.slice(0, email.indexOf("@"));
    user = await User.create({ name, email });
  }

  const token = generateToken(user);

  res.status(200).json({ message: "User verified successfully", user, token });
});

export const myProfile = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;

  res.json({ user });
});

export const updateName = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = await User.findById(req.user?._id);
  if (!user) {
    res.status(404).json({ message: "User not found - Please login" });
    return;
  }

  // const { name } = req.body;
  // user.name = name;

  user.name = req.body.name;

  await user.save();

  const token = generateToken(user);
  res.json({ message: "User updated", user, token });
});

export const getAllUsers = TryCatch(async (req: AuthenticatedRequest, res) => {
  const users = await User.find();

  res.json({ users });
});

export const getAUser = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({ user });
});
