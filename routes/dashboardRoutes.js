const express = require("express");
const router = express.Router();
const Employee = require("../models/Employee");
const BusinessUnit = require("../models/BusinessUnit");
const Log = require("../models/Log"); // assuming you have Log model
const authMiddleware = require("../middleware/authMiddleware");

router.get("/stats", authMiddleware, async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments();
    const totalBusinessUnits = await BusinessUnit.countDocuments();
    const totalLogs = await Log.countDocuments();

    const availableEmployees = await Employee.countDocuments({ isAvailable: true });

    return res.json({
      success: true,
      data: {
        totalEmployees,
        totalBusinessUnits,
        totalLogs,
        availableEmployees
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Dashboard stats fetch failed" });
  }
});

module.exports = router;
