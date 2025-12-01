const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const employeeController = require("../controllers/employeeController");


// CREATE or UPDATE Employee
router.post("/upsert", authMiddleware, employeeController.upsertEmployee);
router.post("/getEmpByRole", authMiddleware, employeeController.getEmployeesByRole);
router.get("/getManagers", authMiddleware, employeeController.getManagersList);
router.get("/getEmployeeByUserId", authMiddleware, employeeController.getLoggedInEmployee);

module.exports = router