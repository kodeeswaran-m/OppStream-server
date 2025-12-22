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
    console.log("emp", userId);

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized. Invalid token." });
    }

    // Get logged-in employee details
    const loggedEmp = await Employee.findOne({ userId });
    if (!loggedEmp) {
      return res.status(404).json({ message: "Employee profile not found" });
    }
    console.log("logged emp", loggedEmp);

    const { role, _id: empId, businessUnitId } = loggedEmp;

    let employees = [];

    // ------------------ ROLE BASED DATA FETCHING ------------------ //

    // 1️⃣ BUH → All employees in same BU except himself
    if (role === "BUH") {
      employees = await Employee.find({
        businessUnitId,
        _id: { $ne: empId },
      })
        // .select(
        //   "_id employeeId employeeName employeeEmail role managerId ancestors"
        // )
        .lean();
    }

    // 2️⃣ AM → All RM + EMP who fall under AM (meaning AM is mentor/ancestor)
    else if (role === "AM") {
      employees = await Employee.find({
        ancestors: empId, // anyone whose chain contains AM
      })
        // .select(
        //   "_id employeeId employeeName employeeEmail role managerId ancestors"
        // )
        .lean();
    }

    // 3️⃣ RM → Direct employees only (managerId = RM)
    else if (role === "RM") {
      employees = await Employee.find({
        managerId: empId, // direct reporting
      })
        // .select(
        //   "_id employeeId employeeName employeeEmail role managerId ancestors"
        // )
        .lean();
    }

    // 4️⃣ EMP → No employees under him
    else {
      employees = []; // empty
    }
    console.log("emp", employees, "role", role);

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
// GET /api/logs/:id
exports.getLogById = async (req, res) => {
  try {
    const log = await Log.findById(req.params.id);
    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.updateLogById = async (req, res) => {
  try {
    // const employee = await Employee.findOne({ userId: req.user.id });
    const employee = await Employee.findOne({ userId: req.user.id }).populate(
      "ancestors",
      "employeeName role employeeId"
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const log = await Log.findById(req.params.id);

    if (!log) {
      return res.status(404).json({ message: "Log not found" });
    }

    /* ---------------- SECURITY CHECKS ---------------- */

    // Only creator can edit
    if (log.createdBy.toString() !== employee._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to edit this log" });
    }

    // Check rejected status
    const rejectedApproval = log.approvals.find((a) => a.status === "REJECTED");

    if (!rejectedApproval) {
      return res
        .status(400)
        .json({ message: "Only rejected logs can be edited" });
    }

    /* ---------------- UPDATE PAYLOAD ---------------- */

    const { requirementType, nnDetails, oppFrom, oppTo, timeline } = req.body;

    log.requirementType = requirementType;
    log.timeline = timeline;

    // Reset fields
    log.nnDetails = undefined;
    log.oppFrom = undefined;
    log.oppTo = undefined;

    if (requirementType === "NN") {
      log.nnDetails = {
        description: nnDetails?.description,
        clientName: nnDetails?.clientName,
        source: nnDetails?.source,
        oppFrom: nnDetails?.oppFrom,
      };
    }

    if (requirementType === "EE" || requirementType === "EN") {
      log.oppFrom = {
        projectName: oppFrom?.projectName,
        clientName: oppFrom?.clientName,
        projectCode: oppFrom?.projectCode,
        urgency: oppFrom?.urgency,
        meetingType: oppFrom?.meetingType,
        meetingDate: oppFrom?.meetingDate,
        meetingScreenshot: oppFrom?.meetingScreenshot,
        peoplePresent: oppFrom?.peoplePresent || [],
      };

      log.oppTo = {
        technologyRequired: oppTo?.technologyRequired || [],
        techRows: oppTo?.techRows || [],
        totalPersons: oppTo?.totalPersons,
        category: oppTo?.category,
        shortDescription: oppTo?.shortDescription,
        detailedNotes: oppTo?.detailedNotes,
      };
    }

    /* ---------------- RESET APPROVAL FLOW ---------------- */

    log.approvals = getApprovalFlow(employee);

    await log.save();

    return res.status(200).json({
      success: true,
      message: "Log updated successfully",
      log,
    });
  } catch (error) {
    console.error("Error updating log:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

exports.updateApprovalStatus = async (req, res) => {
  try {
    const { approvalStatus, rejectionReason } = req.body;
    const logId = req.params.logId;

    if (!["APPROVED", "REJECTED"].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid approval status",
      });
    }

    if (
      approvalStatus === "REJECTED" &&
      (!rejectionReason || !rejectionReason.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    // 🔹 Find logged-in employee
    const employee = await Employee.findOne({ userId: req.user.id });
    if (!employee) {
      return res.status(403).json({
        success: false,
        message: "Employee not found",
      });
    }

    // 🔹 Find log
    const log = await Log.findById(logId);
    if (!log) {
      return res.status(404).json({
        success: false,
        message: "Log not found",
      });
    }

    // 🔹 Match approval by EMPLOYEE ROLE (RM / AM / BUH)
    const approval = log.approvals.find(
      (a) =>
        a.role === employee.role &&
        a.approverId.toString() === employee._id.toString()
    );

    if (!approval) {
      return res.status(403).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (approval.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Approval already processed",
      });
    }

    approval.status = approvalStatus;
    approval.approvedAt = new Date();
    approval.approverName = employee.employeeName;
    approval.rejectionReason =
      approvalStatus === "REJECTED" ? rejectionReason : null;

    await log.save();

    return res.status(200).json({
      success: true,
      message: "Approval updated successfully",
    });
  } catch (error) {
    console.error("Approval error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// exports.getPendingApprovals = async (req, res) => {
//   try {
//     // STEP 1: Logged-in employee
//     const employee = await Employee.findOne({ userId: req.user.id });

//     if (!employee) {
//       return res.status(404).json({ message: "Employee not found" });
//     }

//     const userId = employee._id;
//     const userRole = employee.role; // EMP, RM, AM, BUH

//     // STEP 2: Build role-based match conditions
//     let approvalMatch = {};

//     if (userRole === "RM") {
//       // RM only needs logs where RM approval is pending
//       approvalMatch = {
//         approvals: {
//           $elemMatch: {
//             role: "RM",
//             approverId: userId,
//             status: "PENDING",
//           },
//         },
//       };
//     }

//     if (userRole === "AM") {
//       // AM sees logs only if RM already approved AND AM is pending
//       approvalMatch = {
//         approvals: {
//           $all: [
//             { $elemMatch: { role: "RM", status: "APPROVED" } },
//             {
//               $elemMatch: { role: "AM", approverId: userId, status: "PENDING" },
//             },
//           ],
//         },
//       };
//     }

//     if (userRole === "BUH") {
//       // BUH sees logs only if RM & AM approved AND BUH is pending
//       approvalMatch = {
//         approvals: {
//           $all: [
//             { $elemMatch: { role: "RM", status: "APPROVED" } },
//             { $elemMatch: { role: "AM", status: "APPROVED" } },
//             {
//               $elemMatch: {
//                 role: "BUH",
//                 approverId: userId,
//                 status: "PENDING",
//               },
//             },
//           ],
//         },
//       };
//     }

//     // STEP 3: Fetch logs + populate
//     const logs = await Log.find(approvalMatch)
//       .populate("createdBy", "employeeId employeeName role ancestors")
//       .populate("approvals.approverId", "employeeId employeeName role")
//       .sort({ createdAt: -1 });
//     console.log("pend logs", logs);
//     // STEP 4: Additionally filter logs based on ancestors rule
//     const finalLogs = logs.filter((log) =>
//       log.createdBy?.ancestors?.some(
//         (ancestorId) => ancestorId.toString() === userId.toString()
//       )
//     );

//     return res.status(200).json({
//       success: true,
//       count: finalLogs.length,
//       logs: finalLogs,
//     });
//   } catch (error) {
//     console.error("Error fetching pending approvals:", error);
//     return res.status(500).json({
//       message: "Server error",
//       error: error.message,
//     });
//   }
// };

exports.getPendingApprovals = async (req, res) => {
  try {
    const userRole = req.user.role;

    // ---------------- ADMIN HANDLING ----------------
    if (userRole === "admin") {
      return res.status(200).json({
        success: true,
        count: 0,
        logs: [], // IMPORTANT: always return array
      });
    }

    // ---------------- EMPLOYEE HANDLING ----------------
    const employee = await Employee.findOne({ userId: req.user.id });

    if (!employee) {
      return res.status(200).json({
        success: true,
        count: 0,
        logs: [],
      });
    }

    const userId = employee._id;

    let approvalMatch = {};

    if (employee.role === "RM") {
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

    if (employee.role === "AM") {
      approvalMatch = {
        approvals: {
          $all: [
            { $elemMatch: { role: "RM", status: "APPROVED" } },
            {
              $elemMatch: {
                role: "AM",
                approverId: userId,
                status: "PENDING",
              },
            },
          ],
        },
      };
    }

    if (employee.role === "BUH") {
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

    const logs = await Log.find(approvalMatch)
      .populate("createdBy", "employeeId employeeName role ancestors")
      .populate("approvals.approverId", "employeeId employeeName role")
      .sort({ createdAt: -1 });

    const finalLogs = logs.filter(
      (log) =>
        Array.isArray(log.createdBy?.ancestors) &&
        log.createdBy.ancestors.some(
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
    const loggedInEmployee = await Employee.findOne({ userId: req.user.id });

    if (!loggedInEmployee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const logs = await Log.find({
      approvals: {
        $elemMatch: {
          approverId: loggedInEmployee._id,
          status: { $in: ["APPROVED", "REJECTED"] },
        },
      },
    })
      .populate("createdBy", "employeeName employeeId role team")
      .populate("approvals.approverId", "employeeName employeeId role")
      .sort({ updatedAt: -1 });

    // Extract current user's approval info
    const formattedLogs = logs.map((log) => {
      const myApproval = log.approvals.find(
        (a) =>
          a.approverId._id.toString() ===
          loggedInEmployee._id.toString()
      );

      return {
        ...log.toObject(),
        myApproval, // contains status + rejectionReason
      };
    });

    return res.status(200).json({
      success: true,
      count: formattedLogs.length,
      logs: formattedLogs,
    });
  } catch (error) {
    console.error("Error fetching approver logs:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


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

exports.getUserApprovalCounts = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find employee mapped to logged-in user
    const employee = await Employee.findOne({ userId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const employeeId = employee._id;

    // Find logs that contain this employee in approvals
    const logs = await Log.find({
      "approvals.approverId": employeeId,
    });

    let acceptedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;

    logs.forEach((log) => {
      const approvals = log.approvals;

      approvals.forEach((approval, index) => {
        if (String(approval.approverId) !== String(employeeId)) return;

        // --- ACCEPTED ---
        if (approval.status === "APPROVED") {
          acceptedCount++;
        }

        // --- REJECTED ---
        if (approval.status === "REJECTED") {
          rejectedCount++;
        }

        // --- PENDING WITH SPECIAL RULE ---
        if (approval.status === "PENDING") {
          const previousApprovals = approvals.slice(0, index);

          // Previous approval must exist unless this is first approver
          const allPrevApproved =
            previousApprovals.length === 0 ||
            previousApprovals.every((ap) => ap.status === "APPROVED");

          if (allPrevApproved) {
            pendingCount++;
          }
        }
      });
    });

    return res.status(200).json({
      success: true,
      counts: {
        accepted: acceptedCount,
        rejected: rejectedCount,
        pending: pendingCount,
      },
    });
  } catch (error) {
    console.error("Error fetching approval counts:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

exports.getEmployeeCountsByRole = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const loggedEmp = await Employee.findOne({ userId });
    if (!loggedEmp) {
      return res.status(404).json({ message: "Employee profile not found" });
    }

    const { role, _id: empId, businessUnitId } = loggedEmp;

    let employees = [];

    // -----------------------------------------------------------------
    // ROLE → Fetch allowed employees
    // -----------------------------------------------------------------

    if (role === "VP") {
      // All employees except himself
      employees = await Employee.find({ _id: { $ne: empId } }).lean();
    } else if (role === "BUH") {
      employees = await Employee.find({
        businessUnitId,
        _id: { $ne: empId },
      }).lean();
    } else if (role === "AM") {
      employees = await Employee.find({
        ancestors: empId,
      }).lean();
    } else if (role === "RM") {
      employees = await Employee.find({
        managerId: empId,
      }).lean();
    } else {
      // EMP → no employees
      return res.status(200).json({
        success: true,
        counts: {
          total: 0,
          associateManager: 0,
          reportingManager: 0,
          employee: 0,
        },
      });
    }

    // -----------------------------------------------------------------
    // COUNT by Role
    // -----------------------------------------------------------------

    let total = employees.length;
    let associateManager = employees.filter((e) => e.role === "AM").length;
    let reportingManager = employees.filter((e) => e.role === "RM").length;
    let employee = employees.filter((e) => e.role === "EMP").length;

    // For VP & BUH → return all counts
    if (role === "VP" || role === "BUH") {
      return res.status(200).json({
        success: true,
        counts: {
          total,
          associateManager,
          reportingManager,
          employee,
        },
      });
    }

    // For AM → return RM + EMP only
    if (role === "AM") {
      return res.status(200).json({
        success: true,
        counts: {
          total,
          reportingManager,
          employee,
        },
      });
    }

    // For RM → return only EMP
    if (role === "RM") {
      return res.status(200).json({
        success: true,
        counts: {
          total,
          employee,
        },
      });
    }
  } catch (err) {
    console.error("Error in getEmployeeCountsByRole:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getLogsByEmployeeId = async (req, res) => {
  try {
    const { id } = req.params;

    // 1️⃣ Validate Mongo ObjectId
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required",
      });
    }

    // 2️⃣ Check if employee exists
    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // 3️⃣ Fetch logs created by this employee
    const logs = await Log.find({ createdBy: id })
      .populate("createdBy", "employeeName employeeId role team department")
      .populate("approvals.approverId", "employeeName employeeId role")
      .sort({ createdAt: -1 });
    console.log("logs", logs);
    return res.status(200).json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error("Error fetching employee logs:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
