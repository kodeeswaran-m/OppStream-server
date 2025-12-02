
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

    // EE, EN, NN
    requirementType: {
      type: String,
      enum: ["EE", "EN", "NN"],
      required: true,
    },

    // =================== NN SECTION ===================
    nnDetails: {
      description: String,
      clientName: String,
      source: String,
      oppFrom: String,
    },

    // =================== OPP FROM (EE & EN) ===================
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

    // =================== OPP TO ===================
    oppTo: {
      technologyRequired: [String], // ["React", "Node"]
      techRows: [techRowSchema], // matching dynamic rows
      totalPersons: Number,

      category: String,
      shortDescription: String,
      detailedNotes: String,
    },

    // =================== TIMELINE ===================
    timeline: {
      expectedStart: Date,
      expectedEnd: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Log", logSchema);



// const mongoose = require("mongoose");
// const { Schema } = mongoose;

// const logSchema = new Schema(
//   {
//     createdBy: {
//       type: Schema.Types.ObjectId,
//       ref: "Employee",
//       required: true,
//     },

//     visibleTo: [
//       {
//         type: Schema.Types.ObjectId,
//         ref: "Employee",
//         required: true,
//       },
//     ],

//     requirementType: {
//       type: String,
//       enum: ["EE", "EN", "NN"],
//       required: true,
//     },

//     oppFrom: {
//       projectName: String,
//       clientName: String,
//       projectCode: String,
//       priority: String,
//       meetingType: String,
//       meetingDate: Date,
//       meetingScreenshot: String,
//       peoplePresent: [String],
//     },

//     oppTo: {
//       technologyRequired: [String],
//       totalPersons: Number,
//       category: String,
//       shortDescription: String,
//       detailedNotes: String,
//     },

//     timeline: {
//       expectedStart: Date,
//       expectedEnd: Date,
//     },
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("Log", logSchema);
