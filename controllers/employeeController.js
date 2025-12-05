
const mongoose = require("mongoose");
const Log = require("../models/Log");
const Employee = require("../models/Employee");
const BusinessUnit = require("../models/BusinessUnit");
const { getApprovalFlow } = require("../utils/employeeUtils");

const buildAncestors = async (managerId) => {
  if (!managerId) return [];

  const manager = await Employee.findById(managerId).lean();
  if (!manager) return [];

  const ancestors = [manager._id];

  if (Array.isArray(manager.ancestors) && manager.ancestors.length > 0) {
    ancestors.push(...manager.ancestors);
  }

  return ancestors;
};

exports.upsertEmployee = async (req, res) => {
  try {
    // Extract logged-in user's ID from token (middleware attaches req.user)
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized. Invalid token." });
    }

    // Extract incoming fields
    const {
      employeeId,
      employeeName,
      employeeEmail,
      contactNumber,
      dob,
      workLocation,
      employmentType,
      role,
      managerId,
      businessUnitId,
      department,
      team,
      skills,
      totalExperience,
      previousProjects,
      previousCompanies,
      currentProjects,
      isAvailable,
      resumeFile,
    } = req.body;

    // ---------------- VALIDATIONS ----------------
    if (
      !employeeId ||
      !employeeName ||
      !employeeEmail ||
      !businessUnitId ||
      !role
    ) {
      return res.status(400).json({
        message:
          "Missing required fields (employeeId, name, email, businessUnitId, role)",
      });
    }

    // Check BU exists
    const buExists = await BusinessUnit.findById(businessUnitId);
    if (!buExists) {
      return res.status(404).json({ message: "Business Unit not found" });
    }

    // Check if employee already exists (based on email or employeeId)
    const existingEmp = await Employee.findOne({
      $or: [{ employeeId }, { employeeEmail }],
    });

    // If exists → ensure it's not a different user
    if (existingEmp && existingEmp.userId.toString() !== userId) {
      return res.status(409).json({
        message: "Employee with same email or ID already exists",
      });
    }

    // ---------------- BUILD ANCESTORS ----------------
    let ancestors = [];

    if (role === "BUH") {
      ancestors = []; // top hierarchy
    } else if (managerId) {
      ancestors = await buildAncestors(managerId);
    }

    // ---------------- UPSERT PAYLOAD ----------------
    const employeePayload = {
      userId,
      employeeId,
      employeeName,
      employeeEmail,
      contactNumber,
      dob,
      workLocation,
      employmentType,
      role,
      managerId: managerId || null,
      businessUnitId,
      department,
      team,
      skills,
      totalExperience,
      previousProjects,
      previousCompanies,
      currentProjects,
      isAvailable,
      ancestors,
      resumeFile,
    };

    // ---------------- UPSERT ----------------
    const employee = await Employee.findOneAndUpdate(
      { userId }, // each user may have only one employee profile
      employeePayload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      message: existingEmp
        ? "Employee updated successfully"
        : "Employee created successfully",
      employee,
    });
  } catch (error) {
    console.error("Error in upsertEmployee:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getEmployeesByRole = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized. Invalid token." });
    }

    // Get logged-in employee details
    const loggedEmp = await Employee.findOne({ userId });
    if (!loggedEmp) {
      return res.status(404).json({ message: "Employee profile not found" });
    }

    const { role, _id: empId, businessUnitId } = loggedEmp;

    let employees = [];

    // ------------------ ROLE BASED DATA FETCHING ------------------ //

    // 1️⃣ BUH → All employees in same BU except himself
    if (role === "BUH") {
      employees = await Employee.find({
        businessUnitId,
        _id: { $ne: empId },
      })
        .select(
          "_id employeeId employeeName employeeEmail role managerId ancestors"
        )
        .lean();
    }

    // 2️⃣ AM → All RM + EMP who fall under AM (meaning AM is mentor/ancestor)
    else if (role === "AM") {
      employees = await Employee.find({
        ancestors: empId, // anyone whose chain contains AM
      })
        .select(
          "_id employeeId employeeName employeeEmail role managerId ancestors"
        )
        .lean();
    }

    // 3️⃣ RM → Direct employees only (managerId = RM)
    else if (role === "RM") {
      employees = await Employee.find({
        managerId: empId, // direct reporting
      })
        .select(
          "_id employeeId employeeName employeeEmail role managerId ancestors"
        )
        .lean();
    }

    // 4️⃣ EMP → No employees under him
    else {
      employees = []; // empty
    }

    return res.status(200).json({
      message: "Employees fetched successfully",
      count: employees.length,
      employees,
    });
  } catch (err) {
    console.error("Error fetching employees:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getManagersList = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role; // roles: employee, reporting manager, associate manager, VP

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized. Invalid token." });
    }

    // Fetch the employee profile for the logged-in user
    const loggedEmp = await Employee.findOne({ userId });
    if (!loggedEmp) {
      return res.status(404).json({ message: "Employee profile not found" });
    }

    const empRole = loggedEmp.role; // EMP / RM / AM / BUH
    let targetRole = null;

    // ------------------ ROLE MAPPING LOGIC ------------------

    /**
     * EMP or userRole = employee → fetch RM
     */
    if (empRole === "EMP" || userRole === "employee") {
      targetRole = "RM";
    } else if (empRole === "RM" || userRole === "reporting manager") {
      /**
       * RM or userRole = reporting manager → fetch AM
       */
      targetRole = "AM";
    } else if (empRole === "AM" || userRole === "associate manager") {
      /**
       * AM or userRole = associate manager → fetch BUH
       */
      targetRole = "BUH";
    } else if (empRole === "BUH" || userRole === "VP") {
      /**
       * BUH or userRole = VP → head of BU → no managers above him
       */
      return res.status(200).json({
        message: "This role has no managers above them",
        managers: [],
      });
    }

    // If something unexpected happens
    if (!targetRole) {
      return res
        .status(400)
        .json({ message: "Unable to determine manager role" });
    }
    console.log("target role", targetRole);
    // ------------------ QUERY EMPLOYEES ------------------
    const managers = await Employee.find({ role: targetRole })
      .select("_id employeeId employeeName employeeEmail role businessUnitId")
      .lean();
    console.log("managers", managers);
    return res.status(200).json({
      message: `Managers with role ${targetRole} fetched successfully`,
      count: managers.length,
      managers,
    });
  } catch (error) {
    console.error("Error fetching managers:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getLoggedInEmployee = async (req, res) => {
  try {
    const userId = req.user?.id; // Extracted from JWT in authMiddleware

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized. Invalid token." });
    }

    // Fetch employee using the linked userId
    const employee = await Employee.findOne({ userId })
      .populate("managerId", "employeeName employeeEmail role")
      .populate("businessUnitId", "name")
      .lean();

    if (!employee) {
      return res.status(404).json({ message: "Employee profile not found" });
    }

    return res.status(200).json({
      message: "Employee profile fetched successfully",
      employee,
    });
  } catch (error) {
    console.error("Error fetching logged-in employee:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.createLog = async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.user.id }).populate(
      "ancestors",
      "employeeName role employeeId"
    );
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    // console.log("req.body", employee.ancestors);
    const visibleTo = [...employee.ancestors];
    const approvals = getApprovalFlow(employee);

    const { requirementType, nnDetails, oppFrom, oppTo, timeline } = req.body;
    console.log("approvals", approvals);
    let logPayload = {
      createdBy: employee._id,
      visibleTo,
      requirementType,
      approvals,
      timeline,
    };

    if (requirementType === "NN") {
      logPayload.nnDetails = {
        description: nnDetails?.description,
        clientName: nnDetails?.clientName,
        source: nnDetails?.source,
        oppFrom: nnDetails?.oppFrom,
      };
    }

    if (requirementType === "EE" || requirementType === "EN") {
      logPayload.oppFrom = {
        projectName: oppFrom?.projectName,
        clientName: oppFrom?.clientName,
        projectCode: oppFrom?.projectCode,
        urgency: oppFrom?.urgency,
        meetingType: oppFrom?.meetingType,
        meetingDate: oppFrom?.meetingDate,
        meetingScreenshot: oppFrom?.meetingScreenshot,
        peoplePresent: oppFrom?.peoplePresent || [],
      };
    }

    logPayload.oppTo = {
      technologyRequired: oppTo?.technologyRequired || [],
      techRows: oppTo?.techRows || [],
      totalPersons: oppTo?.totalPersons,
      category: oppTo?.category,
      shortDescription: oppTo?.shortDescription,
      detailedNotes: oppTo?.detailedNotes,
    };

    // STEP 5: Save log
    const newLog = new Log(logPayload);
    await newLog.save();

    return res.status(201).json({
      message: "Log created successfully",
      log: newLog,
    });
  } catch (error) {
    console.error("Error creating log:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

exports.updateApprovalStatus = async (req, res) => {
  try {
    const { logId } = req.params;
    const { status } = req.body; // APPROVED / REJECTED

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid approval status" });
    }

    // STEP 1: Get logged-in employee (approver)
    const approver = await Employee.findOne({ userId: req.user.id });
    if (!approver) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // STEP 2: Find log
    const log = await Log.findById(logId);
    if (!log) {
      return res.status(404).json({ message: "Log not found" });
    }

    // STEP 3: Check if this employee is part of approval chain
    const approvalEntry = log.approvals.find(
      (a) => a.approverId.toString() === approver._id.toString()
    );

    if (!approvalEntry) {
      return res.status(403).json({
        message: "You are not authorized to approve this log",
      });
    }

    // STEP 4: Prevent double approval/rejection
    if (approvalEntry.status !== "PENDING") {
      return res.status(400).json({
        message: `Already ${approvalEntry.status}`,
      });
    }

    // STEP 5: Update approval fields
    approvalEntry.status = status;
    approvalEntry.approvedAt = new Date();
    approvalEntry.approverName = approver.employeeName;

    await log.save();

    return res.status(200).json({
      message: "Approval updated successfully",
      log,
    });
  } catch (error) {
    console.error("Approval update error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getPendingApprovals = async (req, res) => {
  try {
    // STEP 1: Logged-in employee
    const employee = await Employee.findOne({ userId: req.user.id });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const userId = employee._id;
    const userRole = employee.role; // EMP, RM, AM, BUH

    // STEP 2: Build role-based match conditions
    let approvalMatch = {};

    if (userRole === "RM") {
      // RM only needs logs where RM approval is pending
      approvalMatch = {
        approvals: {
          $elemMatch: {
            role: "RM",
            approverId: userId,
            status: "PENDING",
          },
        },
      };
    }
 
    if (userRole === "AM") {
      // AM sees logs only if RM already approved AND AM is pending
      approvalMatch = {
        approvals: {
          $all: [
            { $elemMatch: { role: "RM", status: "APPROVED" } },
            {
              $elemMatch: { role: "AM", approverId: userId, status: "PENDING" },
            },
          ],
        },
      };
    }

    if (userRole === "BUH") {
      // BUH sees logs only if RM & AM approved AND BUH is pending
      approvalMatch = {
        approvals: {
          $all: [
            { $elemMatch: { role: "RM", status: "APPROVED" } },
            { $elemMatch: { role: "AM", status: "APPROVED" } },
            {
              $elemMatch: {
                role: "BUH",
                approverId: userId,
                status: "PENDING",
              },
            },
          ],
        },
      };
    }

    // STEP 3: Fetch logs + populate
    const logs = await Log.find(approvalMatch)
      .populate("createdBy", "employeeId employeeName role ancestors")
      .populate("approvals.approverId", "employeeId employeeName role")
      .sort({ createdAt: -1 });
    console.log("pend logs", logs);
    // STEP 4: Additionally filter logs based on ancestors rule
    const finalLogs = logs.filter((log) =>
      log.createdBy?.ancestors?.some(
        (ancestorId) => ancestorId.toString() === userId.toString()
      )
    );

    return res.status(200).json({
      success: true,
      count: finalLogs.length,
      logs: finalLogs,
    });
  } catch (error) {
    console.error("Error fetching pending approvals:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
}; 

exports.getApprovedOrRejectedLogs = async (req, res) => {
  try {
    // 1️⃣ Find logged-in employee
    const loggedInEmployee = await Employee.findOne({ userId: req.user.id });
    if (!loggedInEmployee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // 2️⃣ Fetch logs where this user is an approver
    const logs = await Log.find({
      approvals: {
        $elemMatch: {
          approverId: loggedInEmployee._id,     // user is an approver
          status: { $in: ["APPROVED", "REJECTED"] }, // and has approved/rejected
        }
      }
    })
      .populate("createdBy", "employeeName employeeId role team")
      .populate("approvals.approverId", "employeeName employeeId role")
      .sort({ updatedAt: -1 });


    return res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });

  } catch (error) {
    console.error("Error fetching approver logs:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// exports.getApprovedOrRejectedLogs = async (req, res) => {
//   try {
//     // 1️⃣ Find logged-in employee record
//     const loggedInEmployee = await Employee.findOne({ userId: req.user.id });

//     if (!loggedInEmployee) {
//       return res.status(404).json({
//         success: false,
//         message: "Employee not found",
//       });
//     }

//     // 2️⃣ Find employees under this user's hierarchy
//     const employeesUnderUser = await Employee.find({
//       ancestors: { $in: [loggedInEmployee._id] },
//     }).select("_id");

//     const employeeIds = employeesUnderUser.map((emp) => emp._id);

//     if (employeeIds.length === 0) {
//       return res.status(200).json({
//         success: true,
//         count: 0,
//         logs: [],
//         message: "No logs found under your reporting hierarchy.",
//       });
//     }

//     // 3️⃣ Fetch logs where ANY approval is APPROVED or REJECTED
//     const logs = await Log.find({
//       createdBy: { $in: employeeIds },
//       "approvals.status": { $in: ["APPROVED", "REJECTED"] }, // Correct filter
//     })
//       .populate("createdBy", "employeeName employeeId role team")
//       .sort({ createdAt: -1 });

//     return res.status(200).json({
//       success: true,
//       count: logs.length,
//       logs,
//     });
//   } catch (error) {
//     console.error("Error fetching ancestor logs:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };

exports.getVisibleLogs = async (req, res) => {
  try {
    // STEP 1: Find logged-in employee using req.user.id
    const employee = await Employee.findOne({ userId: req.user.id });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // STEP 2: Fetch logs where ONLY the logged-in employee is in visibleTo
    const logs = await Log.find({
      createdBy: employee._id,
    })
      .populate("createdBy", "employeeName employeeId")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getReportingEmployeeLogs = async (req, res) => {
  try {
    // STEP 1: Find logged-in employee using req.user.id
    const employee = await Employee.findOne({ userId: req.user.id });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // STEP 2: Fetch logs where ONLY the logged-in employee is in visibleTo
    const logs = await Log.find({
      visibleTo: { $in: [employee._id] },
    })
      .populate("createdBy", "employeeName employeeId employeeEmail role team")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getLogById = async (req, res) => {
  try {
    const { logId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(logId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid log ID format",
      });
    }

    const log = await Log.findById(logId)
      .populate("createdBy", "employeeName employeeId role team")
      .populate("visibleTo", "employeeName employeeId role")
      .populate("approvals.approverId", "employeeName employeeId role");

    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Log not found",
      });
    }

    return res.status(200).json({
      success: true,
      log,
    });

  } catch (error) {
    console.error("Error fetching log by ID:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching log",
      error: error.message,
    });
  }
};
