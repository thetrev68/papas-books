export interface DefaultCategory {
  name: string;
  isTaxDeductible?: boolean;
  children?: DefaultCategory[];
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    name: 'Income',
    children: [
      { name: 'Wages & Salary' },
      { name: 'Interest & Dividends' },
      { name: 'Gifts Received' },
      { name: 'Refunds & Reimbursements' },
      { name: 'Other Income' },
    ],
  },
  {
    name: 'Housing',
    children: [
      { name: 'Mortgage / Rent' },
      { name: 'Property Tax', isTaxDeductible: true },
      { name: 'Home Insurance' },
      { name: 'Repairs & Maintenance' },
      { name: 'HOA Fees' },
      { name: 'Home Improvement' },
    ],
  },
  {
    name: 'Utilities',
    children: [
      { name: 'Electricity' },
      { name: 'Water & Sewer' },
      { name: 'Natural Gas / Heating Oil' },
      { name: 'Internet & Cable' },
      { name: 'Phone' },
      { name: 'Waste Disposal' },
    ],
  },
  {
    name: 'Food',
    children: [
      { name: 'Groceries' },
      { name: 'Dining Out' },
      { name: 'Alcohol / Bars' },
      { name: 'Coffee Shops' },
    ],
  },
  {
    name: 'Transportation',
    children: [
      { name: 'Fuel' },
      { name: 'Car Insurance' },
      { name: 'Car Maintenance' },
      { name: 'Car Payment' },
      { name: 'Public Transit' },
      { name: 'Parking & Tolls' },
      { name: 'Registration & Taxes' },
    ],
  },
  {
    name: 'Health & Wellness',
    children: [
      { name: 'Medical / Doctor', isTaxDeductible: true },
      { name: 'Pharmacy', isTaxDeductible: true },
      { name: 'Health Insurance', isTaxDeductible: true },
      { name: 'Dental', isTaxDeductible: true },
      { name: 'Vision', isTaxDeductible: true },
      { name: 'Fitness / Gym' },
      { name: 'Sports' },
    ],
  },
  {
    name: 'Personal',
    children: [
      { name: 'Clothing' },
      { name: 'Personal Care' },
      { name: 'Hair & Beauty' },
      { name: 'Education' },
      { name: 'Childcare' },
      { name: 'Pet Care' },
    ],
  },
  {
    name: 'Entertainment',
    children: [
      { name: 'Subscriptions (Streaming)' },
      { name: 'Events & Outings' },
      { name: 'Hobbies' },
      { name: 'Travel / Vacation' },
      { name: 'Books & Games' },
    ],
  },
  {
    name: 'Financial',
    children: [
      { name: 'Life Insurance' },
      { name: 'Fees & Charges' },
      { name: 'Financial Service' },
      { name: 'Taxes Paid' },
      { name: 'Charitable Donations', isTaxDeductible: true },
    ],
  },
  {
    name: 'Transfer',
    children: [
      { name: 'Credit Card Payment' },
      { name: 'Savings Transfer' },
      { name: 'Investment Transfer' },
    ],
  },
];
