exports.getApprovalFlow = (employee) => {
  const roleFlow = {
    EMP: ["RM", "AM", "BUH"],
    RM: ["AM", "BUH"],
    AM: ["BUH"],
    BUH: [],
  };

  const requiredRoles = roleFlow[employee.role];

  return requiredRoles.map((role) => {
    // Find the matching approver based on the role
    const approver = employee.ancestors.find((a) => a.role === role);
    // console.log("approvals", {
    //   role,
    //   approverId: approver?._id || null, // Safely handle missing approver
    //   status: "PENDING",
    //   approvedAt: null,
    //   approverName: approver?.employeeName || null, // Optional but useful
    // });
    return {
      role,
      approverId: approver?._id || null, // Safely handle missing approver
      status: "PENDING",
      approvedAt: null,
      approverName: approver?.employeeName || null, // Optional but useful
    };
  });
};

// exports.getApprovalFlow = (employee) => {
//   const roleFlow = {
//     EMP: ["RM", "AM", "BUH"],
//     RM: ["AM", "BUH"],
//     AM: ["BUH"],
//     BUH: [],
//   };

//   // Get only required roles for approval
//   const requiredRoles = roleFlow[employee.role];
// console.log("required role", requiredRoles,"employee anchestters", employee.ancestors[0 ]);
//   // Map required roles to ancestor IDs
//   return requiredRoles.map((role, index) => ({
//     role,
//     approverId: employee.ancestors[index],  // MUST match order of ancestors
//     status: "PENDING",
//     approvedAt: null,
//   }));
// };
