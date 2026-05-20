export const platformAdmin = {
  id: "platform-brandon-roberts",
  name: "Brandon Roberts",
  email: "BrandonTRoberts@proton.me",
  role: "Platform Admin",
  scope: "All business accounts",
};

export const businessAccounts = [
  {
    id: "biz-pine-ridge",
    name: "Pine Ridge Golf Club",
    plan: "Growth",
    status: "Active",
    region: "Scottsdale, AZ",
  },
  {
    id: "biz-red-canyon",
    name: "Red Canyon Links",
    plan: "Starter",
    status: "Active",
    region: "St. George, UT",
  },
  {
    id: "biz-silver-creek",
    name: "Silver Creek Country Club",
    plan: "Enterprise",
    status: "Setup",
    region: "Boise, ID",
  },
];

export const accountUsers = [
  {
    id: "user-pine-admin",
    businessId: "biz-pine-ridge",
    name: "Brandon Roberts",
    email: "brandon@pineridge.example",
    role: "Business Admin",
    status: "Active",
  },
  {
    id: "user-pine-supervisor",
    businessId: "biz-pine-ridge",
    name: "Terry McBride",
    email: "terry@pineridge.example",
    role: "Supervisor",
    status: "Active",
  },
  {
    id: "user-pine-tech",
    businessId: "biz-pine-ridge",
    name: "Derek Hall",
    email: "derek@pineridge.example",
    role: "Technician",
    status: "Active",
  },
  {
    id: "user-red-admin",
    businessId: "biz-red-canyon",
    name: "Marco Ellis",
    email: "marco@redcanyon.example",
    role: "Business Admin",
    status: "Active",
  },
  {
    id: "user-red-tech",
    businessId: "biz-red-canyon",
    name: "Luis Martinez",
    email: "luis@redcanyon.example",
    role: "Technician",
    status: "Invited",
  },
  {
    id: "user-silver-admin",
    businessId: "biz-silver-creek",
    name: "Jamie Brooks",
    email: "jamie@silvercreek.example",
    role: "Business Admin",
    status: "Setup",
  },
];

export function getUsersForBusiness(businessId) {
  return accountUsers.filter((user) => user.businessId === businessId);
}
