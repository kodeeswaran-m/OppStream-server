const Log = require("../models/Log");
const Employee = require("../models/Employee");
const BusinessUnit = require("../models/BusinessUnit");


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
    if (!employeeId || !employeeName || !employeeEmail || !businessUnitId || !role) {
      return res.status(400).json({
        message: "Missing required fields (employeeId, name, email, businessUnitId, role)",
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
      { userId },                  // each user may have only one employee profile
      employeePayload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      message: existingEmp ? "Employee updated successfully" : "Employee created successfully",
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
        .select("_id employeeId employeeName employeeEmail role managerId ancestors")
        .lean();
    }

    // 2️⃣ AM → All RM + EMP who fall under AM (meaning AM is mentor/ancestor)
    else if (role === "AM") {
      employees = await Employee.find({
        ancestors: empId, // anyone whose chain contains AM
      })
        .select("_id employeeId employeeName employeeEmail role managerId ancestors")
        .lean();
    }

    // 3️⃣ RM → Direct employees only (managerId = RM)
    else if (role === "RM") {
      employees = await Employee.find({
        managerId: empId, // direct reporting
      })
        .select("_id employeeId employeeName employeeEmail role managerId ancestors")
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
    }

    /**
     * RM or userRole = reporting manager → fetch AM
     */
    else if (empRole === "RM" || userRole === "reporting manager") {
      targetRole = "AM";
    }

    /**
     * AM or userRole = associate manager → fetch BUH
     */
    else if (empRole === "AM" || userRole === "associate manager") {
      targetRole = "BUH";
    }

    /**
     * BUH or userRole = VP → head of BU → no managers above him
     */
    else if (empRole === "BUH" || userRole === "VP") {
      return res.status(200).json({
        message: "This role has no managers above them",
        managers: [],
      });
    }

    // If something unexpected happens
    if (!targetRole) {
      return res.status(400).json({ message: "Unable to determine manager role" });
    }

    // ------------------ QUERY EMPLOYEES ------------------
    const managers = await Employee.find({ role: targetRole })
      .select("_id employeeId employeeName employeeEmail role businessUnitId")
      .lean();

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
    // STEP 1: FIND EMPLOYEE PROFILE
    console.log("user",req.user.id );
    const employee = await Employee.findOne({ userId: req.user.id });
    console.log("emp", employee);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
console.log("req.body",req.body);
    // STEP 2: BUILD visibleTo USING EMPLOYEE + ANCESTORS
    const visibleTo = [employee._id, ...employee.ancestors];

    // STEP 3: Extract all fields from body
    const {
      requirementType,

      // NN Section
      nnDetails,

      // Opp From
      oppFrom,

      // Opp To
      oppTo,

      // Timeline
      timeline,
    } = req.body;

    // STEP 4: Prepare Log Payload
    let logPayload = {
      createdBy: employee._id,
      visibleTo,
      requirementType,
      timeline,
    };

    // -------------------------------
    // IF NN SECTION
    // -------------------------------
    if (requirementType === "NN") {
      logPayload.nnDetails = {
        description: nnDetails?.description,
        clientName: nnDetails?.clientName,
        source: nnDetails?.source,
        oppFrom: nnDetails?.oppFrom,
      };
    }

    // -------------------------------
    // IF EE / EN SECTION → oppFrom
    // -------------------------------
    if (requirementType === "EE" || requirementType === "EN") {
      logPayload.oppFrom = {
        projectName: oppFrom?.projectName,
        clientName: oppFrom?.clientName,
        projectCode: oppFrom?.projectCode,
        urgency: oppFrom?.urgency,
        meetingType: oppFrom?.meetingType,
        meetingDate: oppFrom?.meetingDate,
        meetingScreenshot: oppFrom?.meetingScreenshot, // cloudinary URL
        peoplePresent: oppFrom?.peoplePresent || [],
      };
    }

    // -------------------------------
    // OPP TO SECTION (Always Applicable)
    // -------------------------------
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

exports.getVisibleLogs = async (req, res) => {
  try {
    // STEP 1: Identify the logged-in employee
    const employee = await Employee.findOne({ userId: req.user.id });

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // STEP 2: The list of IDs that determine visibility
    const visibleToIds = [employee._id, ...employee.ancestors];

    // STEP 3: Fetch logs where visibleTo contains ANY of these IDs
    const logs = await Log.find({
      visibleTo: { $in: visibleToIds }
    })
      .populate("createdBy", "employeeName employeeId role team")
      .sort({ createdAt: -1 });
console.log("logs",logs);
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
