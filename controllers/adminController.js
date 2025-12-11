const BusinessUnit = require("../models/BusinessUnit");

const Log = require("../models/Log"); // Assuming you have a Log model

const User=require("../models/User");
const bcrypt = require("bcryptjs");

const Employee = require("../models/Employee");


exports.createBusinessUnit = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Business unit name is required" });
    }

    // Check duplicate
    const exists = await BusinessUnit.findOne({ name });
    if (exists) {
      return res.status(409).json({ message: "Business unit already exists" });
    }

    const newBU = await BusinessUnit.create({ name });

    res.status(201).json({
      message: "Business Unit created successfully",
      data: newBU,
    });
  } catch (error) {
    console.error("Error creating BU:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.getAllBusinessUnits = async (req, res) => {
  try {
    const businessUnits = await BusinessUnit.find({}, "_id name").sort({ createdAt: -1 });

    res.status(200).json({
      message: "Business Units fetched successfully",
      businessUnits,
    });
  } catch (error) {
    console.error("Error fetching Business Units:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

exports.getDashboardData = async (req, res) => {
  try {
    const employees = await Employee.find({});
    const businessUnits = await BusinessUnit.find({}, "_id name");
    const logs = await Log.find({}).sort({ createdAt: -1 }).limit(100); // last 100 logs

    res.status(200).json({
      message: "Dashboard data fetched successfully",
      data: {
        employees,
        businessUnits,
        logs,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
};


exports.createUser = async (req, res) => {
  const {
    username,
    email,
    password,
    confirmPassword,
    role,
    employeeId,
    businessUnitId,
  } = req.body;

  // 1) Password check
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    // 2) Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // 3) Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4) Create User
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: role || "employee",
    });

    const savedUser = await newUser.save();

    // ------------------------------------------------------
    //    CREATE EMPLOYEE ONLY IF NOT ADMIN
    // ------------------------------------------------------
    if (savedUser.role !== "admin") {
      // Map user roles → Employee roles
      const roleMap = {
        employee: "EMP",
        "reporting manager": "RM",
        "associate manager": "AM",
        VP: "BUH",
      };

      const employeeRole = roleMap[savedUser.role];

      // Validate required fields from frontend
      if (!employeeId) {
        return res.status(400).json({ message: "employeeId is required" });
      }

      if (!businessUnitId) {
        return res.status(400).json({ message: "businessUnitId is required" });
      }

      // 5) Create Employee record using frontend values
      await Employee.create({
        userId: savedUser._id,
        employeeId,
        employeeName: savedUser.username,
        employeeEmail: savedUser.email,
        role: employeeRole,
        businessUnitId,
        ancestors: [], // default minimal
      });
    }

    return res.status(201).json({
      message: "User created successfully",
      userId: savedUser._id,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
};



exports.getAllUsers = async (req, res) => {
  try {
    const { role, search, page = 1, limit = 10 } = req.query;

    const query = {};

    // ----------------------------
    //  ROLE FILTER
    // ----------------------------
    if (role && role !== "all") {
      query.role = role;
    }

    // ----------------------------
    //  SEARCH FILTER (username/email/employeeId)
    // ----------------------------
    if (search) {
      const regex = new RegExp(search, "i");

      // Search in both User + Employee doc
      const employees = await Employee.find({
        $or: [
          { employeeId: regex },
          { employeeName: regex },
          { employeeEmail: regex }
        ]
      }).select("userId");

      const employeeUserIds = employees.map((emp) => emp.userId);

      query.$or = [
        { username: regex },
        { email: regex },
        { _id: { $in: employeeUserIds } }  // match by employee fields
      ];
    }

    // Pagination
    const skip = (page - 1) * limit;

    // ----------------------------
    //   FETCH USERS + EMP DATA
    // ----------------------------
    const users = await User.find(query)
      .select("_id username email role createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Attach employee details only if not admin
    const userIds = users.map((u) => u._id);

    const employees = await Employee.find({ userId: { $in: userIds } })
      .select("userId employeeId employeeName role businessUnitId");

    const employeeMap = {};
    employees.forEach((emp) => {
      employeeMap[emp.userId] = emp;
    });

    const formatted = users.map((u) => ({
      _id: u._id,
      username: u.username,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      employee: employeeMap[u._id] || null,
    }));

    const total = await User.countDocuments(query);

    return res.status(200).json({
      message: "Users fetched successfully",
      success:true,
      total,
      page: Number(page),
      limit: Number(limit),
      users: formatted,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({
      message: "Internal server error",
      success:false
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        message: "User ID is required",
      });
    }

    // ----------------------------
    // CHECK IF USER EXISTS
    // ----------------------------
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // ----------------------------
    // DELETE USER
    // ----------------------------
    await User.findByIdAndDelete(userId);

    // ----------------------------
    // DELETE EMPLOYEE DETAILS
    // ----------------------------
    await Employee.deleteOne({ userId });

    return res.status(200).json({
      success:true,
      message: "User and related employee data deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({
      success:false,
      message: "Internal server error",
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, email, role } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Validate required fields
    if (!username && !email && !role) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update",
      });
    }

    // ----------------------------
    // FIND USER
    // ----------------------------
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ----------------------------
    // PREPARE UPDATE OBJECT
    // ----------------------------
    const updateUserData = {};

    // Update username
    if (username) {
      updateUserData.username = username;
    }

    // Update email
    let emailChanged = false;
    if (email && email !== user.email) {
      updateUserData.email = email;
      emailChanged = true;
    }

    // Update role
    let roleChanged = false;
    if (role && role !== user.role) {
      updateUserData.role = role;
      roleChanged = true;
    }

    // ----------------------------
    // UPDATE USER
    // ----------------------------
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateUserData },
      { new: true }
    ).select("_id username email role createdAt");

    // ----------------------------
    // UPDATE EMPLOYEE DETAILS (IF EXISTS)
    // ----------------------------
    const employee = await Employee.findOne({ userId });

    if (employee) {
      let updateEmployeeData = {};

      // If email changed → update in employee schema also
      if (emailChanged) {
        updateEmployeeData.employeeEmail = email;
      }

      // If role changed → update role mapping
      if (roleChanged) {
        const roleMapping = {
          "VP": "BUH",
          "associate manager": "AM",
          "reporting manager": "RM",
          "employee": "EMP",
        };

        updateEmployeeData.role = roleMapping[role];
      }

      if (Object.keys(updateEmployeeData).length > 0) {
        await Employee.findOneAndUpdate(
          { userId },
          { $set: updateEmployeeData },
          { new: true }
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: updatedUser,
    });

  } catch (error) {
    console.error("Error updating user:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Fetch user
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Optional: Get employee details too, if available
    const employeeDetails = await Employee.findOne({ userId });

    return res.status(200).json({
      success: true,
      message: "User fetched successfully",
      user,
      employee: employeeDetails || null,
    });

  } catch (error) {
    console.error("Error fetching user by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getDepartmentStats = async (req, res) => {
  try {
    const { department } = req.query;

    // -----------------------------
    // CASE 1: All Departments
    // -----------------------------
    if (!department || department === "all") {
      const deptCounts = await Employee.aggregate([
        {
          $group: {
            _id: "$department",
            count: { $sum: 1 },
          },
        },
      ]);

      const result = {};

      deptCounts.forEach((item) => {
        if (item._id) {
          result[item._id] = item.count;
        }
      });

      return res.status(200).json({
        success: true,
        type: "department",
        data: result,
      });
    }

    // -----------------------------
    // CASE 2: Specific Department (Insurance, BFS, JLM)
    // Return team-wise distribution
    // -----------------------------
    const teamCounts = await Employee.aggregate([
      { $match: { department } },
      {
        $group: {
          _id: "$team",
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {};
    teamCounts.forEach((item) => {
      if (item._id) {
        result[item._id] = item.count;
      }
    });

    return res.status(200).json({
      success: true,
      type: "team",
      department,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching department stats:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
