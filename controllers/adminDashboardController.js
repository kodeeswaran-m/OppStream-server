const Employee = require("../models/Employee");
const BusinessUnit = require("../models/BusinessUnit");
const Log = require("../models/Log");

exports.getAdminEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().populate("businessUnitId", "name");

    res.status(200).json({
      message: "Employees fetched successfully",
      employees,
    });
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAdminBusinessUnits = async (req, res) => {
  try {
    const businessUnits = await BusinessUnit.find();

    res.status(200).json({
      message: "Business Units fetched successfully",
      businessUnits,
    });
  } catch (error) {
    console.error("Error fetching business units:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAdminLogs = async (req, res) => {
  try {
    const logs = await Log.find()
      .populate("createdBy", "employeeId employeeName role ancestors")
      .sort({ createdAt: -1 })
      .limit(5);

    res.status(200).json({
      message: "Logs fetched successfully",
      logs,
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments();
    const totalBusinessUnits = await BusinessUnit.countDocuments();
    const totalLogs = await Log.countDocuments();
    const availableEmployees = await Employee.countDocuments({
      status: "Available",
    });

    res.status(200).json({
      totalEmployees,
      totalBusinessUnits,
      totalLogs,
      availableEmployees,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
