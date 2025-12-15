const bcrypt = require("bcryptjs");
const User = require("../models/User");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/jwtUtils");
const jwt = require('jsonwebtoken');
const Employee = require("../models/Employee");

// Signup controller
// exports.signup = async (req, res) => {
//   const { username, email, password, confirmPassword, role } = req.body;
//   console.log("signup data", username, email, password, confirmPassword, role);
//   if (password !== confirmPassword) {
//     return res.status(400).json({ message: "Passwords do not match" });
//   }
//   console.log("1");
//   try {
//     const existingUser = await User.findOne({ email });
//     console.log("1.1", existingUser);
//     if (existingUser) {
//       return res.status(400).json({ message: "User already exists" });
//     }
//     console.log("2");
//     const hashedPassword = await bcrypt.hash(password, 10);

//     const newUser = new User({
//       username,
//       email,
//       password: hashedPassword,
//       role: role || "employee",
//     });

//     await newUser.save();

//     return res.status(201).json({ message: "User created successfully" });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

exports.signup = async (req, res) => {
  const { username, email, password, confirmPassword, role } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: role || "employee",
    });

    const savedUser = await newUser.save();

    // ------------------------------------------------------
    //  ROLE-BASED AUTOMATIC EMPLOYEE CREATION
    // ------------------------------------------------------

    // Do NOT create employee if role = admin
    if (savedUser.role !== "admin") {
      
      // Map User role → Employee role
      const roleMap = {
        employee: "EMP",
        "reporting manager": "RM",
        "associate manager": "AM",
        VP: "BUH",
      };

      const employeeRole = roleMap[savedUser.role];

      // Generate employeeId like EMP1234 (or your logic)
      const employeeId = "ACE" + Math.floor(1000 + Math.random() * 9000);

      await Employee.create({
        userId: savedUser._id,
        employeeId,
        employeeName: savedUser.username,
        employeeEmail: savedUser.email,
        role: employeeRole,
        businessUnitId: "692c3ab45f4e0d407efe63d2", // you can update based on UI
        // ancestors: [],        // default empty
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

// Login controller
exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "Invalid credentials" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  user.refreshToken = refreshToken;
  await user.save();

  res.cookie("rt", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.status(200).json({
    message: "Login successful",
    accessToken,
    user: {
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
};

// Refresh token controller
exports.refreshToken = async (req, res) => {
  console.log("req", req.cookies.rt);
  const refreshToken = req.cookies.rt;

  if (!refreshToken)
    return res.status(401).json({ message: "No refresh token" });

  const user = await User.findOne({ refreshToken });
  if (!user) return res.status(403).json({ message: "Invalid refresh token" });

  jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: "Expired refresh token" });

    const accessToken = generateAccessToken(user);
    return res.json({
      accessToken,
      user: {
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  });
};

// Logout controller
exports.logout = async (req, res) => {
  const refreshToken = req.cookies.rt;
  await User.updateOne({ refreshToken }, { $unset: { refreshToken: "" } });

  res.clearCookie("rt", {
  httpOnly: true,
  secure: true,
  sameSite: "none",
});

  return res.status(200).json({ message: "Logged out successfully" });
};
