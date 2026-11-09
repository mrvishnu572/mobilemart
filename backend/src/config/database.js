import mongoose from "mongoose";

import { env } from "./env.js";
import ReturnExchange from "../models/return-exchange.model.js";

export const connectDatabase = async () => {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI);
  // Older releases enforced one case per entire order. Remove that legacy
  // unique index so customers can open a separate case for each order item.
  try {
    await ReturnExchange.collection.dropIndex("one_return_exchange_per_order");
  } catch (error) {
    if (error?.code !== 27 && error?.codeName !== "IndexNotFound") throw error;
  }
  await ReturnExchange.createIndexes();
  console.log("Connected to MongoDB");
};

