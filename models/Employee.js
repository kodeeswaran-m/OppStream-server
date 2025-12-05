const mongoose = require("mongoose");
const { Schema } = mongoose;

const employeeSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    employeeId: { type: String, required: true, unique: true },
    employeeName: { type: String, required: true },
    employeeEmail: { type: String, required: true, unique: true },
    contactNumber: { type: String },
    dob: { type: Date },
    workLocation: { type: String },
    employmentType: {
      type: String,
      enum: ["Full Time", "Intern", "Contract"],
      default: "Full Time",
    },
    role: {
      type: String,
      required: true,
      enum: ["EMP", "RM", "AM", "BUH"],
      default: "EMP",
    },

    managerId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    ancestors: [
      {
        type: Schema.Types.ObjectId,
        ref: "Employee",
        required: true,
      },
    ],

    businessUnitId: {
      type: Schema.Types.ObjectId,
      ref: "BusinessUnit",
      required: true,
    },

    department: { type: String },
    team: { type: String },
    skills: [
      {
        skillName: { type: String },
        proficiencyLevel: { type: String },
        experience: { type: Number },
        // certifications: [String]
      },
    ],
    totalExperience: { type: Number },
    previousProjects: [{ type: String }],
    previousCompanies: [{ type: String }],
    currentProjects: [{ type: String }],

    isAvailable: { type: Boolean, default: true },

    resumeFile: { type: String }, // Cloudinary / AWS link

  },

  { timestamps: true }
);

module.exports = mongoose.model("Employee", employeeSchema);
