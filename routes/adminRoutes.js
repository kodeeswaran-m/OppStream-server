const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const adminController = require("../controllers/adminController");

// Admin-only create route
router.post(
  "/create",
  authMiddleware,       // Verify token
  adminMiddleware,      // Check admin
  adminController.createBusinessUnit
);
// GET ALL BUs
router.get("/all", adminController.getAllBusinessUnits);

module.exports = router;
