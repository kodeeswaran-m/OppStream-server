const mongoose = require("mongoose");
const { Schema } = mongoose;

const logSchema = new Schema(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    visibleTo: [
      {
        type: Schema.Types.ObjectId,
        ref: "Employee",
        required: true,
      },
    ],

    requirementType: {
      type: String,
      enum: ["EE", "EN", "NN"],
      required: true,
    },

    oppFrom: {
      projectName: String,
      clientName: String,
      projectCode: String,
      priority: String,
      meetingType: String,
      meetingDate: Date,
      meetingScreenshot: String,
      // audioVideo: String,
      peoplePresent: [String],
    },

    oppTo: {
      technologyRequired: [String],
      totalPersons: Number,
      expertiseLevel: String,
      category: String,
      shortDescription: String,
      detailedNotes: String,
    },

    timeline: {
      expectedStart: Date,
      expectedEnd: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Log", logSchema);
