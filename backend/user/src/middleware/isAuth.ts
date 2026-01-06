import type { NextFunction, Response, Request } from "express";
import type { IUser } from "../model/user.js";
import jwt, { type JwtPayload } from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: IUser | null;
}

export const isAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "Please Login - No auth header" });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({ message: "Please Login - Token missing" });
      return;
    }

    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET not defined");
    }

    const decodedValue = jwt.verify(token, JWT_SECRET) as JwtPayload;

    if (!decodedValue || !decodedValue.user) {
      res.status(401).json({ message: "Invalid Token" });
      return;
    }

    req.user = decodedValue.user;

    next();
  } catch (error) {
    res.status(401).json({ message: "Please Login - Jwt Error" });
  }
};
