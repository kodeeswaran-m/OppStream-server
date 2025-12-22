const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const employeeController = require("../controllers/employeeController");

console.log("Employee routes loaded!");

router.post("/upsert", authMiddleware, employeeController.upsertEmployee);
router.post("/createLog", authMiddleware, employeeController.createLog);
router.get("/getEmpByRole", authMiddleware, employeeController.getEmployeesByRole);
router.post("/:logId/approval", authMiddleware, employeeController.updateApprovalStatus);
router.get("/:logId/getLogById", authMiddleware, employeeController.getLogById);
router.get("/getManagers", authMiddleware, employeeController.getManagersList);
router.get("/getEmployeeByUserId", authMiddleware, employeeController.getLoggedInEmployee);
router.get("/getReportingEmployeeLogs", authMiddleware, employeeController.getReportingEmployeeLogs);
router.get("/getVisibleLogs", authMiddleware, employeeController.getVisibleLogs);
router.get("/getPendingApprovalLogs", authMiddleware, employeeController.getPendingApprovals);
router.get("/getApprovedOrRejectedLogs", authMiddleware, employeeController.getApprovedOrRejectedLogs);
router.get("/getUserApprovalCounts", authMiddleware, employeeController.getUserApprovalCounts);
router.get("/getEmployeeCounts", authMiddleware, employeeController.getEmployeeCountsByRole);

module.exports = router

