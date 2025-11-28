require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const morgan=require("morgan")
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const employeeRoutes = require('./routes/employeeRoute');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));  // Allow frontend app to access cookies

connectDB();

app.use('/api/auth', authRoutes);
app.use('/api/business-units', adminRoutes);
app.use('/api/employee', employeeRoutes);



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
