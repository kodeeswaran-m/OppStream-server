exports.getApprovalFlow = (employee) => {
  const roleFlow = {
    EMP: ["RM", "AM", "BUH"],
    RM: ["AM", "BUH"],
    AM: ["BUH"],
    BUH: [],
  };

  const requiredRoles = roleFlow[employee.role];

  if (!requiredRoles) {
    throw new Error(`Invalid employee role: ${employee.role}`);
  }

  return requiredRoles.map((role) => {
    const approver = employee.ancestors.find(
      (a) => a.role === role
    );

    if (!approver) {
      throw new Error(
        `Approver not found for role ${role} (employee ${employee.employeeId})`
      );
    }

    return {
      role,
      approverId: approver._id, // ✅ NEVER null
      status: "PENDING",
      approvedAt: null,
      approverName: approver.employeeName,
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

//   const requiredRoles = roleFlow[employee.role];

//   return requiredRoles.map((role) => {
//     // Find the matching approver based on the role
//     const approver = employee.ancestors.find((a) => a.role === role);
//     // console.log("approvals", {
//     //   role,
//     //   approverId: approver?._id || null, // Safely handle missing approver
//     //   status: "PENDING",
//     //   approvedAt: null,
//     //   approverName: approver?.employeeName || null, // Optional but useful
//     // });
//     return {
//       role,
//       approverId: approver?._id || null, // Safely handle missing approver
//       status: "PENDING",
//       approvedAt: null,
//       approverName: approver?.employeeName || null, // Optional but useful
//     };
//   });
// };

