const mongoose = require("mongoose");
const { Schema } = mongoose;

const peopleSchema = new Schema({
  name: { type: String, required: true },
});

const techRowSchema = new Schema({
  technology: { type: String, required: true },
  count: { type: Number, required: true },
});

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

    nnDetails: {
      description: String,
      clientName: String,
      source: String,
      oppFrom: String,
    },

    oppFrom: {
      projectName: String,
      clientName: String,
      projectCode: String,
      urgency: String,
      meetingType: String,
      meetingDate: Date,
      meetingScreenshot: String, // Cloudinary URL or local path

      peoplePresent: [peopleSchema], // [{ name: "Sam" }]
    },

    oppTo: {
      technologyRequired: [String], // ["React", "Node"]
      techRows: [techRowSchema], // matching dynamic rows
      totalPersons: Number,

      category: String,
      shortDescription: String,
      detailedNotes: String,
    },

    timeline: {
      expectedStart: Date,
      expectedEnd: Date,
    },
    approvals: [
      {
        role: {
          type: String,
          enum: ["RM", "AM", "BUH"],
          required: true,
        },
        approverId: {
          type: Schema.Types.ObjectId,
          ref: "Employee",
          required: true,
        },
        status: {
          type: String,
          enum: ["PENDING", "APPROVED", "REJECTED"],
          default: "PENDING",
        },
        rejectionReason: {
          type: String,
          default: null,
        },
        approvedAt: {
          type: Date,
        },
        approverName: {
          type: String,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Log", logSchema);
