require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const employeeRoutes = require("./routes/employeeRoute");
const adminDashboardRoutes = require("./routes/adminDashboardRoutes");

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
const axiosInstance = axios.create({
  baseURL: "https://oppstream-server.onrender.com",
  withCredentials: true,
  timeout: 15000,
});

connectDB();

app.use("/api/auth", authRoutes);
app.use("/api/business-units", adminRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use("/api/admin", adminDashboardRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("demo");
});
