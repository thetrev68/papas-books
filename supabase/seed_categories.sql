/*
  SEED DEFAULT CATEGORIES
  
  Instructions:
  1. Replace 'YOUR_BOOKSET_ID_HERE' with your actual Bookset ID (UUID).
     You can find this in the 'booksets' table or via the App > Settings.
  2. Run this script in the Supabase SQL Editor.
*/

DO $$
DECLARE
  -- REPLACE THIS WITH YOUR TARGET BOOKSET ID
  target_bookset_id uuid := '157c852f-6b62-46d9-89ae-d8abad4d95fa'; 
  
  -- Variables for parent IDs
  income_id uuid;
  housing_id uuid;
  utils_id uuid;
  food_id uuid;
  trans_id uuid;
  health_id uuid;
  pers_id uuid;
  ent_id uuid;
  fin_id uuid;
  transfer_id uuid;
BEGIN

  -- 1. Income
  INSERT INTO categories (name, bookset_id, sort_order, is_tax_deductible) 
  VALUES ('Income', target_bookset_id, 10, false) RETURNING id INTO income_id;
  
    INSERT INTO categories (name, bookset_id, parent_category_id, sort_order) VALUES 
      ('Wages & Salary', target_bookset_id, income_id, 1),
      ('Interest & Dividends', target_bookset_id, income_id, 2),
      ('Gifts Received', target_bookset_id, income_id, 3),
      ('Refunds & Reimbursements', target_bookset_id, income_id, 4),
      ('Other Income', target_bookset_id, income_id, 5);

  -- 2. Housing
  INSERT INTO categories (name, bookset_id, sort_order, is_tax_deductible) 
  VALUES ('Housing', target_bookset_id, 20, false) RETURNING id INTO housing_id;

    INSERT INTO categories (name, bookset_id, parent_category_id, sort_order, is_tax_deductible) VALUES 
      ('Mortgage / Rent', target_bookset_id, housing_id, 1, false),
      ('Property Tax', target_bookset_id, housing_id, 2, true),
      ('Home Insurance', target_bookset_id, housing_id, 3, false),
      ('Repairs & Maintenance', target_bookset_id, housing_id, 4, false),
      ('HOA Fees', target_bookset_id, housing_id, 5, false),
      ('Home Improvement', target_bookset_id, housing_id, 6, false);

  -- 3. Utilities
  INSERT INTO categories (name, bookset_id, sort_order, is_tax_deductible) 
  VALUES ('Utilities', target_bookset_id, 30, false) RETURNING id INTO utils_id;

    INSERT INTO categories (name, bookset_id, parent_category_id, sort_order) VALUES 
      ('Electricity', target_bookset_id, utils_id, 1),
      ('Water & Sewer', target_bookset_id, utils_id, 2),
      ('Natural Gas / Heating Oil', target_bookset_id, utils_id, 3),
      ('Internet & Cable', target_bookset_id, utils_id, 4),
      ('Phone', target_bookset_id, utils_id, 5),
      ('Waste Disposal', target_bookset_id, utils_id, 6);

  -- 4. Food
  INSERT INTO categories (name, bookset_id, sort_order, is_tax_deductible) 
  VALUES ('Food', target_bookset_id, 40, false) RETURNING id INTO food_id;

    INSERT INTO categories (name, bookset_id, parent_category_id, sort_order) VALUES 
      ('Groceries', target_bookset_id, food_id, 1),
      ('Dining Out', target_bookset_id, food_id, 2),
      ('Alcohol / Bars', target_bookset_id, food_id, 3),
      ('Coffee Shops', target_bookset_id, food_id, 4);

  -- 5. Transportation
  INSERT INTO categories (name, bookset_id, sort_order, is_tax_deductible) 
  VALUES ('Transportation', target_bookset_id, 50, false) RETURNING id INTO trans_id;

    INSERT INTO categories (name, bookset_id, parent_category_id, sort_order) VALUES 
      ('Fuel', target_bookset_id, trans_id, 1),
      ('Car Insurance', target_bookset_id, trans_id, 2),
      ('Car Maintenance', target_bookset_id, trans_id, 3),
      ('Car Payment', target_bookset_id, trans_id, 4),
      ('Public Transit', target_bookset_id, trans_id, 5),
      ('Parking & Tolls', target_bookset_id, trans_id, 6),
      ('Registration & Taxes', target_bookset_id, trans_id, 7);

  -- 6. Health & Wellness
  INSERT INTO categories (name, bookset_id, sort_order, is_tax_deductible) 
  VALUES ('Health & Wellness', target_bookset_id, 60, false) RETURNING id INTO health_id;

    INSERT INTO categories (name, bookset_id, parent_category_id, sort_order, is_tax_deductible) VALUES 
      ('Medical / Doctor', target_bookset_id, health_id, 1, true),
      ('Pharmacy', target_bookset_id, health_id, 2, true),
      ('Health Insurance', target_bookset_id, health_id, 3, true),
      ('Dental', target_bookset_id, health_id, 4, true),
      ('Vision', target_bookset_id, health_id, 5, true),
      ('Fitness / Gym', target_bookset_id, health_id, 6, false),
      ('Sports', target_bookset_id, health_id, 7, false);

  -- 7. Personal
  INSERT INTO categories (name, bookset_id, sort_order, is_tax_deductible) 
  VALUES ('Personal', target_bookset_id, 70, false) RETURNING id INTO pers_id;

    INSERT INTO categories (name, bookset_id, parent_category_id, sort_order) VALUES 
      ('Clothing', target_bookset_id, pers_id, 1),
      ('Personal Care', target_bookset_id, pers_id, 2),
      ('Hair & Beauty', target_bookset_id, pers_id, 3),
      ('Education', target_bookset_id, pers_id, 4),
      ('Childcare', target_bookset_id, pers_id, 5),
      ('Pet Care', target_bookset_id, pers_id, 6);

  -- 8. Entertainment
  INSERT INTO categories (name, bookset_id, sort_order, is_tax_deductible) 
  VALUES ('Entertainment', target_bookset_id, 80, false) RETURNING id INTO ent_id;

    INSERT INTO categories (name, bookset_id, parent_category_id, sort_order) VALUES 
      ('Subscriptions (Streaming)', target_bookset_id, ent_id, 1),
      ('Events & Outings', target_bookset_id, ent_id, 2),
      ('Hobbies', target_bookset_id, ent_id, 3),
      ('Travel / Vacation', target_bookset_id, ent_id, 4),
      ('Books & Games', target_bookset_id, ent_id, 5);

  -- 9. Financial
  INSERT INTO categories (name, bookset_id, sort_order, is_tax_deductible) 
  VALUES ('Financial', target_bookset_id, 90, false) RETURNING id INTO fin_id;

    INSERT INTO categories (name, bookset_id, parent_category_id, sort_order, is_tax_deductible) VALUES 
      ('Life Insurance', target_bookset_id, fin_id, 1, false),
      ('Fees & Charges', target_bookset_id, fin_id, 2, false),
      ('Financial Service', target_bookset_id, fin_id, 3, false),
      ('Taxes Paid', target_bookset_id, fin_id, 4, false),
      ('Charitable Donations', target_bookset_id, fin_id, 5, true);

  -- 10. Transfer
  INSERT INTO categories (name, bookset_id, sort_order, is_tax_deductible) 
  VALUES ('Transfer', target_bookset_id, 100, false) RETURNING id INTO transfer_id;

    INSERT INTO categories (name, bookset_id, parent_category_id, sort_order) VALUES 
      ('Credit Card Payment', target_bookset_id, transfer_id, 1),
      ('Savings Transfer', target_bookset_id, transfer_id, 2),
      ('Investment Transfer', target_bookset_id, transfer_id, 3);

END $$;
