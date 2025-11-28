const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, minlength: 3 },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["employee", "reporting manager", "associate manager", "VP", "admin"],
    default: "employee",
  },
  refreshToken: { type: String },
});

module.exports = mongoose.model("User", userSchema);
