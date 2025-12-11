const BusinessUnit = require("../models/BusinessUnit");
const Log = require("../models/Log"); // Assuming you have a Log model
const Employee = require("../models/Employee");


exports.createBusinessUnit = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Business unit name is required" });
    }

    // Check duplicate
    const exists = await BusinessUnit.findOne({ name });
    if (exists) {
      return res.status(409).json({ message: "Business unit already exists" });
    }

    const newBU = await BusinessUnit.create({ name });

    res.status(201).json({
      message: "Business Unit created successfully",
      data: newBU,
    });
  } catch (error) {
    console.error("Error creating BU:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.getAllBusinessUnits = async (req, res) => {
  try {
    const businessUnits = await BusinessUnit.find({}, "_id name").sort({ createdAt: -1 });

    res.status(200).json({
      message: "Business Units fetched successfully",
      businessUnits,
    });
  } catch (error) {
    console.error("Error fetching Business Units:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

exports.getDashboardData = async (req, res) => {
  try {
    const employees = await Employee.find({});
    const businessUnits = await BusinessUnit.find({}, "_id name");
    const logs = await Log.find({}).sort({ createdAt: -1 }).limit(100); // last 100 logs

    res.status(200).json({
      message: "Dashboard data fetched successfully",
      data: {
        employees,
        businessUnits,
        logs,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
};

