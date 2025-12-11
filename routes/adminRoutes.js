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
router.post(
  "/createUser",
  authMiddleware,       // Verify token
  adminMiddleware,      // Check admin
  adminController.createUser
);

router.get("/all", adminController.getAllBusinessUnits);
router.get("/getAllUsers", adminController.getAllUsers);
router.get("/getUserById/:userId", adminController.getUserById);
router.get("/department-stats", adminController.getDepartmentStats);

router.delete("/deleteUser/:userId", adminController.deleteUser);
router.put("/updateUser/:userId", adminController.updateUser);

router.get(
  "/dashboard",
  authMiddleware,   // Verify token
  adminMiddleware,  // Check if user is admin
  adminController.getDashboardData
);

module.exports = router;
