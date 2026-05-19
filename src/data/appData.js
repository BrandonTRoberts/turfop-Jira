export const navigation = [
  'My Work',
  'Dashboard',
  'Admin',
  'Course Areas',
  'Work Orders',
  'Equipment',
  'Inventory',
  'Crew Board',
  'Integrations',
  'Profile'
];

export const courses = [
  {
    id: 'course-001',
    name: 'Pine Ridge Golf Club',
    region: 'Scottsdale, AZ',
    superintendent: 'Dana Holt'
  },
  {
    id: 'course-002',
    name: 'Red Canyon Links',
    region: 'St. George, UT',
    superintendent: 'Marco Ellis'
  },
  {
    id: 'course-003',
    name: 'Silver Creek Country Club',
    region: 'Boise, ID',
    superintendent: 'Jamie Brooks'
  }
];

export const summaryStatsByCourse = {
  'course-001': [
    { label: 'Greens completed', value: '14 / 18', detail: 'Morning mow in progress' },
    { label: 'Irrigation alerts', value: '3', detail: '2 west fairways, 1 practice green' },
    { label: 'Equipment uptime', value: '92%', detail: '2 units in service bay' },
    { label: 'Crew assigned', value: '11', detail: '2 teams active on course' }
  ],
  'course-002': [
    { label: 'Greens completed', value: '18 / 18', detail: 'All greens completed by noon' },
    { label: 'Irrigation alerts', value: '1', detail: 'Back nine rough line pressure warning' },
    { label: 'Equipment uptime', value: '96%', detail: 'Fleet performing normally' },
    { label: 'Crew assigned', value: '8', detail: 'One split crew on irrigation and bunkers' }
  ],
  'course-003': [
    { label: 'Greens completed', value: '9 / 18', detail: 'Weather delay slowed morning pass' },
    { label: 'Irrigation alerts', value: '5', detail: 'Multiple heads under inspection' },
    { label: 'Equipment uptime', value: '88%', detail: 'One fairway mower out for service' },
    { label: 'Crew assigned', value: '13', detail: 'Full rotation across turf teams' }
  ]
};

export const seedWorkOrders = [
  {
    id: 'wo-001',
    courseId: 'course-001',
    title: 'Green 7 moisture check',
    detail: 'Soil moisture dropped below threshold',
    status: 'High',
    assignee: 'Irrigation Team',
    technicianName: 'Luis Martinez',
    laborHours: 1.5,
    laborRate: 42,
    laborCost: 63,
    partsCost: 18,
    totalCost: 81,
    completedWorkNotes: ''
  },
  {
    id: 'wo-002',
    courseId: 'course-001',
    title: 'Bunker edge repair, hole 12',
    detail: 'Assign to grounds crew before Wednesday',
    status: 'Open',
    assignee: 'Grounds Crew',
    technicianName: 'Evan Brooks',
    laborHours: 3,
    laborRate: 38,
    laborCost: 114,
    partsCost: 55,
    totalCost: 169
  },
  {
    id: 'wo-003',
    courseId: 'course-001',
    title: 'Sprayer calibration',
    detail: 'Required before next fertilizer application',
    status: 'Completed',
    assignee: 'Shop Lead',
    technicianName: 'Derek Hall',
    laborHours: 2,
    laborRate: 48,
    laborCost: 96,
    partsCost: 12,
    totalCost: 108,
    completedWorkNotes: 'Calibration completed and spray pattern verified before the next application window.',
    completedAt: '2026-05-05T16:30:00.000Z'
  },
  {
    id: 'wo-004',
    courseId: 'course-002',
    title: 'Tee box divot refill, holes 1-9',
    detail: 'Heavy weekend traffic left multiple tee surfaces thin',
    status: 'Open',
    assignee: 'Turf Crew',
    technicianName: 'Marco Ellis',
    laborHours: 2.25,
    laborRate: 36,
    laborCost: 81,
    partsCost: 24,
    totalCost: 105
  },
  {
    id: 'wo-005',
    courseId: 'course-003',
    title: 'Drainage inspection near fairway 6',
    detail: 'Standing water reported after overnight rain',
    status: 'High',
    assignee: 'Grounds Crew',
    technicianName: 'Jamie Brooks',
    laborHours: 4,
    laborRate: 41,
    laborCost: 164,
    partsCost: 0,
    totalCost: 164
  }
];

export const seedEquipment = [
  {
    id: 'eq-001',
    courseId: 'course-001',
    name: 'John Deere 2750 E-Cut',
    make: 'John Deere',
    model: '2750 E-Cut',
    assignedArea: 'Greens 1-9',
    vin: '1M02750ECPM441201',
    serialNumber: 'JD-2750-441201',
    description: 'Triplex greens mower used for daily greens cutting.',
    hours: '1124 hrs',
    detail: 'Blade inspection due in 6 hrs',
    status: 'Needs service'
  },
  {
    id: 'eq-002',
    courseId: 'course-001',
    name: 'Toro Reelmaster 5510',
    make: 'Toro',
    model: 'Reelmaster 5510',
    assignedArea: 'Fairways 1-9',
    vin: 'TC5510RM84722019',
    serialNumber: 'TOR-5510-84722',
    description: 'Fairway mower assigned to front-nine rotation.',
    hours: '847 hrs',
    detail: 'Hydraulic service scheduled',
    status: 'Scheduled'
  },
  {
    id: 'eq-003',
    courseId: 'course-001',
    name: 'Smithco Sprayer',
    make: 'Smithco',
    model: 'Star Command Spray Star',
    assignedArea: 'Practice range and nursery',
    vin: 'SMI-SSC-41200918',
    serialNumber: 'SM-412-918',
    description: 'Dedicated sprayer for fertilizer and turf treatment applications.',
    hours: '412 hrs',
    detail: 'Calibration overdue',
    status: 'Overdue'
  },
  {
    id: 'eq-004',
    courseId: 'course-002',
    name: 'Toro Workman GTX',
    make: 'Toro',
    model: 'Workman GTX',
    vin: 'TGX2664X2020',
    serialNumber: 'GTX-2664',
    description: 'Utility vehicle used for crew transport and light hauling.',
    hours: '266 hrs',
    detail: 'Tire replacement planned next week',
    status: 'Scheduled'
  },
  {
    id: 'eq-005',
    courseId: 'course-003',
    name: 'Jacobsen Fairway Mower',
    make: 'Jacobsen',
    model: 'LF570',
    vin: 'JAC-LF570-1388',
    serialNumber: 'LF570-1388',
    description: 'Primary fairway mower for wide-area daily cutting.',
    hours: '1388 hrs',
    detail: 'Hydraulic leak under diagnosis',
    status: 'Needs service'
  }
];

export const defaultCourseAreaSettings = [
  { name: 'Greens', trackedCount: 18, note: 'Daily cut and moisture logs' },
  { name: 'Tees', trackedCount: 36, note: 'Rotation and divot repair' },
  { name: 'Fairways', trackedCount: 18, note: 'Mow and irrigation coverage' },
  { name: 'Bunkers', trackedCount: 42, note: 'Edges, sand depth, drainage' },
  { name: 'Practice areas', trackedCount: 3, note: 'High wear monitoring' }
];

export const courseAreas = defaultCourseAreaSettings.map((area) => ({
  ...area,
  count: `${area.trackedCount} tracked`
}));

export const inventory = [
  {
    id: 'part-001',
    courseId: 'course-001',
    sku: 'HYD-FLTR-01',
    partDescription: 'Hydraulic filter kit for Toro and Deere service intervals',
    quantityOnHand: 3,
    unitCost: 28.5,
    reorderUrl: ''
  },
  {
    id: 'part-002',
    courseId: 'course-001',
    sku: 'SPRY-NZL-12',
    partDescription: 'Sprayer nozzle replacement pack',
    quantityOnHand: 8,
    unitCost: 12.75,
    reorderUrl: ''
  },
  {
    id: 'part-003',
    courseId: 'course-002',
    sku: 'TIRE-GTX-09',
    partDescription: 'Toro Workman GTX tire set component',
    quantityOnHand: 4,
    unitCost: 86,
    reorderUrl: ''
  },
  {
    id: 'part-004',
    courseId: 'course-003',
    sku: 'SEAL-HYD-44',
    partDescription: 'Hydraulic seal kit for fairway mower leak repairs',
    quantityOnHand: 2,
    unitCost: 44,
    reorderUrl: ''
  }
];

export const crewTasks = [
  { team: 'Morning Greens Team', assignment: 'Cut greens 1-18 and roll front nine', progress: 78 },
  { team: 'Bunker Crew', assignment: 'Edge and rake holes 10-18', progress: 52 },
  { team: 'Shop', assignment: 'Complete sprayer calibration and inspect reels', progress: 34 }
];

export const fieldLogs = [
  { area: 'Green 3', category: 'Moisture', note: 'Surface firming up, hand water tonight', timestamp: '4:10 PM' },
  { area: 'Fairway 11', category: 'Irrigation', note: 'Head 4C showing weak pressure', timestamp: '2:25 PM' },
  { area: 'Shop', category: 'Equipment', note: 'Replaced left reel bearing on backup mower', timestamp: '11:40 AM' }
];

export const backendSchemaNotes = [
  'Each golf course is stored as its own location record with separate operational ownership.',
  'Employees can belong to more than one course, but access is controlled by explicit course memberships and roles.',
  'Work orders, equipment, inventory, time entries, and audit events all carry course scope to keep data separated.',
  'The API enforces course-based access, password hashing, JWT auth, CORS rules, and audit logging on protected flows.',
  'The same backend supports the web app plus the native-ready iOS and Android shells built on Capacitor.'
];
