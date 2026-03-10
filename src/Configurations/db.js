const mongoose = require("mongoose");
const colors = require("colors");

const connectDB = async () => {
    console.log('MONGO_URI:', process.env.MONGO_URI);
  try {
    
    const conn = await mongoose.connect("mongodb+srv://flashmessagingapp:flashadm1n@cluster0.h6jgfz8.mongodb.net/?retryWrites=true&w=majority", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      //useFindAndModify: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline);
  } catch (error) {
    console.log(`Error: ${error.message}`.red.bold);
    process.exit();
  }
};

module.exports = connectDB;