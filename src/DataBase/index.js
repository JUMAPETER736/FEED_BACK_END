import mongoose from "mongoose";
import { DB_NAME } from "../Constants.js";

/** @type {typeof mongoose | undefined} */
export let dbInstance = undefined;

const connectDB = async () => {
  try {
    // const connectionInstance = await mongoose.connect(
    //   `${process.env.MONGODB_URI}/${DB_NAME}`
    // );


    const connectionInstance = await mongoose.connect("mongodb://127.0.0.1:27017/flash");
    dbInstance = connectionInstance;
    console.log(
      `\n  MongoDB Connected! Db host: ${connectionInstance.connection.host}\n`
    );
  } catch (error) {
    console.log("MongoDB connection error: ", error);
    process.exit(1);
  }
};

export default connectDB;
