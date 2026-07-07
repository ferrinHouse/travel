const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

const chicagoMeals = [
  // Day 0
  { dayNumber: 0, mealType: 'Lunch', mealName: 'Car Lunch', time: '12:30 PM', details: 'Simple handheld sandwiches eaten on the road inside the van.' },
  { dayNumber: 0, mealType: 'Dinner', mealName: 'Dinner Out/Takeaway', time: 'Evening', details: 'Relax by the pool. Dinner out near hotel or takeaway.' },
  // Day 1
  { dayNumber: 1, mealType: 'Breakfast', mealName: 'Hotel Breakfast', time: '08:00 AM', details: 'Free breakfast at hotel before driving to Chicago.' },
  { dayNumber: 1, mealType: 'Lunch', mealName: 'Car Snacking', time: '12:30 PM', details: 'Quick mid-drive car snacks/wraps to stay on schedule.' },
  { dayNumber: 1, mealType: 'Dinner', mealName: 'Taco Night at the VRBO', time: '05:30 PM', details: 'Cook up a family taco feast and enjoy a relaxing evening.' },
  // Day 2
  { dayNumber: 2, mealType: 'Breakfast', mealName: 'VRBO Breakfast', time: '07:45 AM', details: 'Cereal, bananas, and fresh fruit at the VRBO.' },
  { dayNumber: 2, mealType: 'Lunch', mealName: 'Picnic Lunch', time: '12:30 PM', details: 'Outside at "Man with a Fish" statue (skyline views from cooler backpacks).' },
  { dayNumber: 2, mealType: 'Dinner', mealName: "Giordano's on Navy Pier", time: '05:30 PM', details: 'Famous deep dish pizza (order via app 1 hour early!).' },
  // Day 3
  { dayNumber: 3, mealType: 'Breakfast', mealName: 'VRBO Breakfast', time: '08:00 AM', details: 'Cereal, bananas, and fresh fruit at the VRBO.' },
  { dayNumber: 3, mealType: 'Lunch', mealName: 'Packed Lunch', time: '12:30 PM', details: 'Eat in the Siragusa Center (Lower Level), a dedicated space for families with their own food.' },
  { dayNumber: 3, mealType: 'Dinner', mealName: 'VRBO Cooking: Pasta/Burgers', time: '05:30 PM', details: 'Family night in; cook baked pasta or steak burgers at the VRBO.' },
  // Day 4
  { dayNumber: 4, mealType: 'Breakfast', mealName: 'VRBO Breakfast', time: '08:30 AM', details: 'Cereal, bananas, and fresh fruit at the VRBO.' },
  { dayNumber: 4, mealType: 'Lunch', mealName: 'Picnic Lunch', time: '12:30 PM', details: 'Pack-and-eat lunch on the Museum Campus lawns from cooler backpacks.' },
  { dayNumber: 4, mealType: 'Dinner', mealName: 'Chicago Dogs', time: '05:30 PM', details: 'Enjoy Chicago Dogs at Chicago Dog House.' },
  // Day 5
  { dayNumber: 5, mealType: 'Breakfast', mealName: 'Clean out VRBO fridge', time: '08:00 AM', details: 'Final VRBO breakfast (cereal, remaining bananas/fruit, clean out fridge).' },
  { dayNumber: 5, mealType: 'Lunch', mealName: 'Packed Sandwiches', time: '11:10 AM', details: 'Prep and eat packed deli sandwiches inside the van right before hitting the road.' },
  { dayNumber: 5, mealType: 'Dinner', mealName: 'Road Dinner', time: '06:00 PM', details: 'Fast-food drive-thru stop along I-90 in Albert Lea, MN.' }
];

const bostonMeals = [
  // Day 1
  { dayNumber: 1, mealType: 'Breakfast', mealName: 'Homewood Suites Breakfast', time: 'Morning', details: 'Free Hot Breakfast Daily.' },
  { dayNumber: 1, mealType: 'Lunch', mealName: 'Walk to Bartaco or Shake Shack', time: '12:30 PM', details: 'Seaport options. Dessert Splurge #1: Levain Bakery OR J.P. Licks.' },
  { dayNumber: 1, mealType: 'Dinner', mealName: 'In-Suite Dinner', time: '06:00 PM', details: 'Relax and unpack after landing.' },
  // Day 2
  { dayNumber: 2, mealType: 'Breakfast', mealName: 'Homewood Suites Breakfast', time: 'Morning', details: 'Free Hot Breakfast Daily.' },
  { dayNumber: 2, mealType: 'Lunch', mealName: 'Packed disposable lunch', time: '12:30 PM', details: 'MOS Tip: disposable bag/paper lunch to discard before game. Dessert Splurge #2: Mike\'s Pastry OR Modern Pastry.' },
  { dayNumber: 2, mealType: 'Dinner', mealName: 'Fenway Franks & Stadium Food', time: '07:10 PM', details: 'Red Sox vs. Rays @ Fenway Park.' },
  // Day 3
  { dayNumber: 3, mealType: 'Breakfast', mealName: 'Homewood Suites Breakfast', time: 'Morning', details: 'Free Hot Breakfast Daily.' },
  { dayNumber: 3, mealType: 'Lunch', mealName: 'Packed cooler lunch', time: '12:30 PM', details: 'Eat on the Whale Watch Cruise (Returns 2:00 PM). Dessert Splurge #3: Taiyaki NYC OR Original Boston Cream Pie.' },
  { dayNumber: 3, mealType: 'Dinner', mealName: 'In-Suite Dinner or takeout', time: 'Dinner', details: 'Head back to the hotel to cook a simple meal or order takeout.' },
  // Day 4
  { dayNumber: 4, mealType: 'Breakfast', mealName: 'Homewood Suites Breakfast', time: 'Morning', details: 'Free Hot Breakfast Daily.' },
  { dayNumber: 4, mealType: 'Lunch', mealName: 'Packed Lunch', time: '01:00 PM', details: 'Find a spot in Harvard Yard or along the Charles River to eat. Dessert Splurge #4: Toscanini\'s Ice Cream OR L.A. Burdick.' },
  { dayNumber: 4, mealType: 'Dinner', mealName: 'Dinner In-Suite', time: '06:00 PM', details: 'Cook meal in suite before evening tour.' },
  // Day 5
  { dayNumber: 5, mealType: 'Breakfast', mealName: 'Homewood Suites Breakfast', time: 'Morning', details: 'Free Hot Breakfast Daily.' },
  { dayNumber: 5, mealType: 'Lunch', mealName: 'Quincy Market / Faneuil Hall or Joe\'s Waterfront', time: '12:30 PM', details: 'Right next to the aquarium.' },
  { dayNumber: 5, mealType: 'Dinner', mealName: 'Farewell Dinner: View Boston or Shake Shack', time: 'Dinner', details: 'View Boston for sunset views OR Shake Shack on the Seaport steps.' },
  // Day 6
  { dayNumber: 6, mealType: 'Breakfast', mealName: 'Breakfast & Checkout', time: '09:00 AM', details: 'Before heading to Logan Airport.' }
];

const bostonGroceries = [
  { name: 'Bottled Water', category: "Trader Joe's (Day 1)" },
  { name: 'Assorted Snacks', category: "Trader Joe's (Day 1)" },
  { name: 'Lunch Meat & Bread', category: "Trader Joe's (Day 1)" },
  { name: 'Paper Lunch Bags', category: "Trader Joe's (Day 1)" },
  { name: 'Frozen Dinners', category: "Trader Joe's (Day 1)" }
];

const hawaiiMeals = [
  // Day 1
  { dayNumber: 1, mealType: 'Dinner', mealName: 'Marukame Udon', time: 'Dinner', details: 'Handmade noodles, very affordable. Daily Treat: Dole Whip at Island Vintage Shave Ice.' },
  // Day 2
  { dayNumber: 2, mealType: 'Lunch', mealName: 'Packed Snacks/Sandwiches', time: 'Lunch', details: 'Eat on the lawn outside the Pearl Harbor gates.' },
  { dayNumber: 2, mealType: 'Dinner', mealName: 'Condo Spaghetti Night', time: 'Dinner', details: 'Daily Treat: Leonard\'s Bakery Malasadas.' },
  // Day 3
  { dayNumber: 3, mealType: 'Lunch', mealName: 'North Shore Food Trucks', time: 'Lunch', details: 'Giovanni\'s Shrimp Truck, etc. Daily Treat: Matsumoto Shave Ice in Haleiwa.' },
  { dayNumber: 3, mealType: 'Dinner', mealName: 'Leftovers at the condo', time: 'Dinner', details: '' },
  // Day 4
  { dayNumber: 4, mealType: 'Lunch', mealName: 'Sandwiches at the beach', time: 'Lunch', details: 'Waikiki Beach. Daily Treat: Kai Coffee Macadamia Nut Latte.' },
  { dayNumber: 4, mealType: 'Dinner', mealName: 'Taco Night!', time: 'Dinner', details: 'Cooking at the condo.' },
  // Day 5
  { dayNumber: 5, mealType: 'Lunch', mealName: 'Musubi Cafe Iyasume', time: 'Lunch', details: 'Spam/Egg rice balls.' },
  { dayNumber: 5, mealType: 'Dinner', mealName: 'Clean out the condo fridge', time: 'Dinner', details: 'Last night in Oahu.' },
  // Day 6
  { dayNumber: 6, mealType: 'Dinner', mealName: 'Arrival Feast', time: 'Dinner', details: 'Rotisserie Chicken, Bagged Caesar Salad, Rice. Daily Treat: Tropical Dreams Ice Cream.' },
  // Day 7
  { dayNumber: 7, mealType: 'Lunch', mealName: 'Packed Sandwiches', time: 'Lunch', details: 'Eat on beach at Punaluʻu. Daily Treat: Big Island Candies.' },
  { dayNumber: 7, mealType: 'Dinner', mealName: 'Cafe 100 (Hilo)', time: 'Dinner', details: 'Cheap eats / Loco Moco.' },
  // Day 8
  { dayNumber: 8, mealType: 'Lunch', mealName: 'Packed Wraps & Chips', time: 'Lunch', details: '' },
  { dayNumber: 8, mealType: 'Dinner', mealName: 'Packed Picnic Dinner / Thermos Cocoa', time: 'Dinner', details: 'Eat at Mauna Kea Visitor Center during stargazing. Daily Treat: Original Big Island Shave Ice Co.' },
  // Day 9
  { dayNumber: 9, mealType: 'Lunch', mealName: 'Packed picnic at the beach', time: 'Lunch', details: 'Hapuna Beach. Daily Treat: Tex Drive-In.' },
  { dayNumber: 9, mealType: 'Dinner', mealName: 'BBQ Burgers', time: 'Dinner', details: 'Condo grill.' },
  // Day 10
  { dayNumber: 10, mealType: 'Lunch', mealName: 'Final Poke Bowl or Food Truck', time: 'Lunch', details: 'Kailua-Kona town.' },
  { dayNumber: 10, mealType: 'Dinner', mealName: 'Sit-down dinner in Kona town', time: 'Dinner', details: 'Before heading to KOA airport.' }
];

async function main() {
  console.log('Seeding meal planning data...');

  // Clear existing meals and Boston groceries to avoid duplicates
  await prisma.mealPlan.deleteMany();
  await prisma.groceryItem.deleteMany({
    where: {
      tripId: 'boston'
    }
  });

  // 1. Seed Chicago meals
  console.log('Seeding Chicago meals...');
  for (const meal of chicagoMeals) {
    await prisma.mealPlan.create({
      data: {
        tripId: 'chicago',
        ...meal
      }
    });
  }

  // 2. Seed Boston meals and groceries
  console.log('Seeding Boston meals and groceries...');
  for (const meal of bostonMeals) {
    await prisma.mealPlan.create({
      data: {
        tripId: 'boston',
        ...meal
      }
    });
  }
  for (const item of bostonGroceries) {
    await prisma.groceryItem.create({
      data: {
        tripId: 'boston',
        name: item.name,
        category: item.category,
        isBought: false
      }
    });
  }

  // 3. Seed Hawaii meals
  console.log('Seeding Hawaii meals...');
  for (const meal of hawaiiMeals) {
    await prisma.mealPlan.create({
      data: {
        tripId: 'hawaii',
        ...meal
      }
    });
  }

  console.log('Seeding meal planning completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    // Process exits naturally
  });
