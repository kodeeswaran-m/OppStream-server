const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const employeeController = require("../controllers/employeeController");

console.log("Employee routes loaded!");

router.post("/upsert", authMiddleware, employeeController.upsertEmployee);
router.post("/createLog", authMiddleware, employeeController.createLog);
router.post("/getEmpByRole", authMiddleware, employeeController.getEmployeesByRole);
router.get("/getManagers", authMiddleware, employeeController.getManagersList);
router.get("/getEmployeeByUserId", authMiddleware, employeeController.getLoggedInEmployee);
router.get("/getVisibleLogs", authMiddleware, employeeController.getVisibleLogs);

module.exports = router