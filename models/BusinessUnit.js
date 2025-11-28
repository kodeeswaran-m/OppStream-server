const mongoose = require("mongoose");
const { Schema } = mongoose;

const businessUnitSchema = new Schema(
  {
    name: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BusinessUnit", businessUnitSchema);
