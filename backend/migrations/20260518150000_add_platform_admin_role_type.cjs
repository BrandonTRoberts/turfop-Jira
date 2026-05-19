exports.shorthands = undefined;

exports.up = pgm => {
  pgm.dropConstraint('employees', 'employees_company_role_check');
  pgm.addConstraint('employees', 'employees_company_role_check', {
    check: "company_role IN ('company_super_user', 'platform_admin')"
  });
};

exports.down = pgm => {
  pgm.dropConstraint('employees', 'employees_company_role_check');
  pgm.addConstraint('employees', 'employees_company_role_check', {
    check: "company_role = 'company_super_user'"
  });
};
