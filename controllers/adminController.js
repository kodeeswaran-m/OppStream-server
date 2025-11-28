const BusinessUnit = require("../models/BusinessUnit");

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
