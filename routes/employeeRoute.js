const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const employeeController = require("../controllers/employeeController");

console.log("Employee routes loaded!");

// Employee profile
router.post("/upsert", authMiddleware, employeeController.upsertEmployee);
router.get("/getEmployeeByUserId", authMiddleware, employeeController.getLoggedInEmployee);
router.get("/getEmpByRole", authMiddleware, employeeController.getEmployeesByRole);
router.get("/getManagers", authMiddleware, employeeController.getManagersList);
router.get("/getEmployeeCounts", authMiddleware, employeeController.getEmployeeCountsByRole);

// Logs
router.post("/createLog", authMiddleware, employeeController.createLog);
router.get("/:logId/getLogById", authMiddleware, employeeController.getLogById);
router.get("/getReportingEmployeeLogs", authMiddleware, employeeController.getReportingEmployeeLogs);
router.get("/getVisibleLogs", authMiddleware, employeeController.getVisibleLogs);

// ✅ APPROVAL (UPDATED – supports rejection reason)
//router.post("/:logId/approve", authMiddleware, employeeController.approveLog);
router.post(
  "/:logId/approval",
  authMiddleware,
  employeeController.updateApprovalStatus
);

// Approvals listing
router.get("/getPendingApprovalLogs", authMiddleware, employeeController.getPendingApprovals);
router.get("/getApprovedOrRejectedLogs", authMiddleware, employeeController.getApprovedOrRejectedLogs);
router.get("/getUserApprovalCounts", authMiddleware, employeeController.getUserApprovalCounts);

router.get("/getEmployeeCounts", authMiddleware, employeeController.getEmployeeCountsByRole);
router.get(
  "/getLogsByEmployeeId/:id",
  authMiddleware,
  employeeController.getLogsByEmployeeId
);

module.exports = router;
