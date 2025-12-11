const express = require("express");
const router = express.Router();

const adminDashboardController = require("../controllers/adminDashboardController");

// Admin Dashboard Analytics Routes
router.get("/dashboard/stats", adminDashboardController.getDashboardStats);
router.get("/employees", adminDashboardController.getAdminEmployees);
router.get("/business-units", adminDashboardController.getAdminBusinessUnits);
router.get("/logs", adminDashboardController.getAdminLogs);

module.exports = router;
