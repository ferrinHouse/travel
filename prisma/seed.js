const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });



async function main() {
  console.log('Clearing database...');
  await prisma.checklistItem.deleteMany();
  await prisma.logisticsCard.deleteMany();
  await prisma.itineraryActivity.deleteMany();
  await prisma.itineraryDay.deleteMany();
  await prisma.mealPlan.deleteMany();
  await prisma.groceryItem.deleteMany();
  await prisma.trip.deleteMany();

  console.log('Seeding trips...');

  // 1. CHICAGO GETAWAY
  await prisma.trip.create({
    data: {
      id: 'chicago',
      name: 'Chicago Getaway',
      description: 'Family trip to the Windy City. Museums, deep dish, and sightseeing around downtown.',
      dates: 'June 20 – June 25, 2026',
      travelers: 'Family of 6',
      status: 'upcoming',
      startDate: new Date('2026-06-20T00:00:00Z'),
      endDate: new Date('2026-06-25T00:00:00Z'),
      tag: 'City',
      primaryColor: '#004488',
      accentColor: '#d9534f',
      checklist: {
        create: [
          { text: 'MEMBERSHIP: Bring Washington Pavilion Card (ASTC Logo) for Field Museum reciprocity.', category: 'pre-trip', isCompleted: false },
          { text: 'PACKING: Prep cooler backpacks with sandwiches and water for museum days.', category: 'packing', isCompleted: false },
          { text: 'TRANSIT: Bookmark the #146 Bus Schedule and Water Taxi Schedule.', category: 'app', isCompleted: false }
        ]
      },
      logistics: {
        create: [
          {
            title: 'Transport & Real-Time Links',
            content: `**Sioux Falls to Madison:** [View Directions (~6 hrs)](https://www.google.com/maps/dir/Sioux+Falls,+SD/Residence+Inn+Madison+West+Middleton)
**Madison to Chicago:** [View Directions (~3 hrs)](https://www.google.com/maps/dir/Residence+Inn+Madison+West+Middleton/421+Cermak+Rd+Chicago)

**Trackers:** [CTA Bus Tracker](https://www.transitchicago.com/bustracker/) | [CTA Train Tracker](https://www.transitchicago.com/traintracker/)`,
            order: 0
          },
          {
            title: 'Accommodations',
            content: `**Madison (Jun 20-21):** [Residence Inn West/Middleton](https://www.marriott.com/en-us/hotels/msnmw-residence-inn-madison-west-middleton/overview/)
8400 Market Street | Conf: #97527747

**Chicago (Jun 21-25):** Vrbo - 421 W Cermak Rd
James Lim | Conf: #HA-FZ5F26`,
            order: 1
          }
        ]
      },
      groceries: {
        create: [
          { name: '3–4 family-size boxes of Cereal', category: 'Breakfast (VRBO Mornings)' },
          { name: '3 gallons of Milk', category: 'Breakfast (VRBO Mornings)' },
          { name: '2 large bunches of Bananas', category: 'Breakfast (VRBO Mornings)' },
          { name: 'Assorted fresh fruit (berries/grapes)', category: 'Breakfast (VRBO Mornings)' },
          { name: '3 loaves of sliced Bread & 1-2 packs of Wraps', category: 'Packed Lunches (Museum & Car Days)' },
          { name: '3 lbs sliced Deli Meat (Turkey/Ham)', category: 'Packed Lunches (Museum & Car Days)' },
          { name: '2 packs of sliced Cheese', category: 'Packed Lunches (Museum & Car Days)' },
          { name: 'Squeeze bottles of Mayo & Mustard', category: 'Packed Lunches (Museum & Car Days)' },
          { name: '1 large variety box of Chips', category: 'Packed Lunches (Museum & Car Days)' },
          { name: '1 bag of Baby Carrots + Ranch dip', category: 'Packed Lunches (Museum & Car Days)' },
          { name: 'Fruit cups or applesauce pouches', category: 'Packed Lunches (Museum & Car Days)' },
          { name: '2 twenty-four packs of Bottled Water', category: 'Packed Lunches (Museum & Car Days)' },
          { name: '2–3 lbs Ground Beef or Chicken', category: 'VRBO Dinner 1: Taco Bar' },
          { name: '2–3 packets of Taco Seasoning', category: 'VRBO Dinner 1: Taco Bar' },
          { name: '1 box Hard Shells & 2 packs Soft Tortillas', category: 'VRBO Dinner 1: Taco Bar' },
          { name: 'Toppings: Shredded lettuce, sour cream, salsa', category: 'VRBO Dinner 1: Taco Bar' },
          { name: '2 bags shredded Mexican-blend Cheese', category: 'VRBO Dinner 1: Taco Bar' },
          { name: '1–2 cans of Black or Refried beans', category: 'VRBO Dinner 1: Taco Bar' },
          { name: '6-pack premium Steak Burger patties', category: 'VRBO Dinner 2: Stovetop/Griddle' },
          { name: '1 pack Brioche Burger buns', category: 'VRBO Dinner 2: Stovetop/Griddle' },
          { name: 'Alternative/Back-up: 2 boxes Spaghetti + 2 jars Marinara', category: 'VRBO Dinner 2: Stovetop/Griddle' },
          { name: '1 loaf of frozen or bakery Garlic Bread', category: 'VRBO Dinner 2: Stovetop/Griddle' }
        ]
      },
      days: {
        create: [
          {
            dayNumber: 0,
            dateLabel: 'Day 0: Saturday, June 20',
            title: 'The Road to Madison',
            activities: {
              create: [
                { time: '09:00 AM', description: 'Depart Sioux Falls for Madison, WI.', order: 0 },
                { time: '12:30 PM', description: 'Car Lunch: Simple handheld sandwiches eaten on the road inside the van.', order: 1 },
                { time: '03:00 PM', description: 'Check-in: [Residence Inn Madison West/Middleton](https://www.marriott.com/en-us/hotels/msnmw-residence-inn-madison-west-middleton/overview/).', order: 2 },
                { time: 'Evening', description: 'Relax by the pool. Dinner out near hotel/takeaway.', order: 3 }
              ]
            }
          },
          {
            dayNumber: 1,
            dateLabel: 'Day 1: Sunday, June 21',
            title: 'Travel & Relaxing at VRBO Taco Night',
            activities: {
              create: [
                { time: '08:00 AM', description: 'Breakfast: Free breakfast at hotel before driving to Chicago.', order: 0 },
                { time: '12:30 PM', description: 'Car Lunch: Quick mid-drive car snacks/wraps to stay on schedule.', order: 1 },
                { time: 'Afternoon', description: 'Hang Out: Arrive in Chicago, check into the VRBO, play games, and relax. Ping Tom Park is a short 15-min walk away if the kids need playground time.', order: 2 },
                { time: '05:30 PM', description: 'Dinner: Taco Night at the VRBO! Cook up a family taco feast and enjoy a relaxing evening.', order: 3 }
              ]
            }
          },
          {
            dayNumber: 2,
            dateLabel: 'Day 2: Monday, June 22',
            title: 'Shedd, Field Museum & Navy Pier Giordano\'s',
            activities: {
              create: [
                { time: '07:45 AM', description: 'Breakfast: Cereal, bananas, and fresh fruit at the VRBO.', order: 0 },
                { time: '08:30 AM', description: 'Transit: Take Northbound #146 Bus from State & Cermak to Museum Campus.', order: 1 },
                { time: '09:00 AM', description: '[Shedd Aquarium](https://www.sheddaquarium.org/): Explore Abbott Oceanarium and Polar Play Zone.', order: 2 },
                { time: '12:30 PM', description: 'Picnic Lunch: Outside at "Man with a Fish" statue (skyline views from cooler backpacks).', order: 3 },
                { time: '02:00 PM', description: '[Field Museum](https://www.fieldmuseum.org/): Preview using ASTC reciprocity for Pokémon Exhibit.', order: 4 },
                { time: '04:30 PM', description: '[Shoreline Water Taxi](https://shorelinesightseeing.com/watertaxi/): Lake Route from Museum Campus (near Adler) to Navy Pier (alternatively, take #146 Bus).', order: 5 },
                { time: '05:30 PM', description: 'Dinner: [Giordano\'s on Navy Pier](https://giordanos.com/locations/navy-pier/): Famous deep dish pizza (order via app 1 hour early!).', order: 6 },
                { time: '07:30 PM', description: 'Return Transit: Take #29 Bus South from Navy Pier back to State & Cermak.', order: 7 }
              ]
            }
          },
          {
            dayNumber: 3,
            dateLabel: 'Day 3: Tuesday, June 23',
            title: 'Science & Industry Full Day',
            activities: {
              create: [
                { time: '08:00 AM', description: 'Breakfast: Cereal, bananas, and fresh fruit at the VRBO.', order: 0 },
                { time: '09:02 AM', description: 'Transit: Take [Metra Electric (ME)](https://metra.com/train-lines/metra-electric) Southbound from McCormick Place station.', order: 1 },
                { time: '09:10 AM', description: 'Arrival: Arrive at 55th-56th-57th St Station; 8-min walk to museum entrance.', order: 2 },
                { time: '09:30 AM', description: '[Griffin Museum of Science and Industry](https://www.msichicago.org/): Enter at opening. Prioritize the Idea Factory and U-505 Submarine.', order: 3 },
                { time: '12:30 PM', description: 'Packer Lunch: Eat in the Siragusa Center (Lower Level), a dedicated space for families with their own food.', order: 4 },
                { time: '04:30 PM', description: 'Return: Catch Northbound Metra Electric back to McCormick Place.', order: 5 },
                { time: '05:30 PM', description: 'Dinner: Family night in; cook baked pasta/steak burgers at the VRBO.', order: 6 }
              ]
            }
          },
          {
            dayNumber: 4,
            dateLabel: 'Day 4: Wednesday, June 24',
            title: 'Museums, Chicago Dogs & 360 Chicago Fireworks',
            activities: {
              create: [
                { time: '08:30 AM', description: 'Breakfast: Cereal, bananas, and fresh fruit at the VRBO.', order: 0 },
                { time: '10:00 AM', description: 'Transit: Take Northbound #146 Bus from State & Cermak to Museum Campus.', order: 1 },
                { time: '10:30 AM', description: 'Museum Time: Return to the [Field Museum](https://www.fieldmuseum.org/) for final exploration or visit the [Adler Planetarium](https://www.adlerplanetarium.org/).', order: 2 },
                { time: '12:30 PM', description: 'Picnic Lunch: Pack-and-eat lunch on the Museum Campus lawns from cooler backpacks.', order: 3 },
                { time: '03:45 PM', description: 'Transit to North Bridge: Take Northbound #146 Bus to North Bridge / Grand Ave.', order: 4 },
                { time: '04:30 PM', description: 'Early Dinner: Enjoy Chicago Dogs at [Chicago\'s Dog House](https://www.originalchicagosdoghouse.com/) (Level 4, North Bridge).', order: 5 },
                { time: '06:00 PM', description: 'Walk to 360: Walk north along Michigan Ave to the John Hancock Building (~10 mins).', order: 6 },
                { time: '06:30 PM', description: '[360 CHICAGO](https://360chicago.com/): Head up for the TILT experience, sunset, and watch the Navy Pier Fireworks (starting at 9:00 PM) from high above!', order: 7 },
                { time: '09:30 PM', description: 'Return Transit: Take [Red Line South](https://www.transitchicago.com/redline/) (Chicago Ave station) to Cermak-Chinatown.', order: 8 }
              ]
            }
          },
          {
            dayNumber: 5,
            dateLabel: 'Day 5: Thursday, June 25',
            title: 'The Bean & Return Drive',
            activities: {
              create: [
                { time: '08:00 AM', description: 'Breakfast: Final VRBO breakfast (cereal, remaining bananas/fruit, clean out fridge).', order: 0 },
                { time: '09:00 AM', description: 'Check-out: Depart VRBO and drive north to Millennium Park.', order: 1 },
                { time: '09:30 AM', description: 'Parking: Park at [Millennium Park Garage](https://www.millenniumgarages.com/) or Lakeside Garage.', order: 2 },
                { time: '10:00 AM', description: '[Millennium Park](https://www.chicago.gov/city/en/depts/dca/supp_info/millennium_park.html): Photos at "The Bean" (Cloud Gate) and a final run at Maggie Daley Park.', order: 3 },
                { time: '11:10 AM', description: 'Car Lunch: Prep and eat packed deli sandwiches inside the van right before hitting the road.', order: 4 },
                { time: '11:30 AM', description: 'Departure: Begin the 9-hour drive back to Sioux Falls.', order: 5 },
                { time: '06:00 PM', description: 'Road Dinner: Fast-food drive-thru stop along I-90 in Albert Lea, MN to break up the drive.', order: 6 }
              ]
            }
          }
        ]
      }
    }
  });

  // 2. BOSTON
  await prisma.trip.create({
    data: {
      id: 'boston',
      name: 'Boston',
      description: 'Five-night stay exploring historic Boston, plus a scheduled whale watching cruise.',
      dates: 'July 16-21, 2026',
      travelers: 'Mike, Caron, Johnathan',
      status: 'upcoming',
      startDate: new Date('2026-07-16T00:00:00Z'),
      endDate: new Date('2026-07-21T00:00:00Z'),
      tag: 'City & Sea',
      primaryColor: '#004488',
      accentColor: '#d9534f',
      checklist: {
        create: [
          { text: 'Red Sox Tickets Purchased.', category: 'pre-trip', isCompleted: true },
          { text: 'Whale Watch Tickets Purchased.', category: 'pre-trip', isCompleted: true },
          { text: 'May 2026: Check Gardner Museum calendar for "Thursday Night" music.', category: 'pre-trip', isCompleted: false },
          { text: 'May 2026: Book Ghosts & Gravestones Walking Tour for Sunday Night.', category: 'pre-trip', isCompleted: false },
          { text: 'June 2026: Research Comedy Club events for Saturday night (Check age restrictions for 16-year-old).', category: 'pre-trip', isCompleted: false },
          { text: 'PACKING: Bring Washington Pavilion Membership Card (ASTC Logo).', category: 'packing', isCompleted: false },
          { text: 'PACKING: Motion sickness meds & sweatshirts for Whale Watch.', category: 'packing', isCompleted: false },
          { text: 'APP: Download MBTA mTicket and the MLB Ballpark app for game tickets.', category: 'app', isCompleted: false }
        ]
      },
      logistics: {
        create: [
          {
            title: 'Flights (Sun Country)',
            content: `**Outbound:** Thu, July 16
SY251 | MSP 6:55 AM → BOS 10:38 AM
Seats: **13 A, B, C**

**Return:** Tue, July 21
SY252 | BOS 11:40 AM → MSP 1:49 PM
Seats: **13 A, B, C**

*Includes 1 Checked Bag + 1 Under-seat item per person.*`,
            order: 0
          },
          {
            title: 'Hotel (Homewood Suites)',
            content: `**[Homewood Suites Seaport District](https://www.hilton.com/en/hotels/bossehw-homewood-suites-boston-seaport-district/)**
670 Summer Street, Boston, MA
Conf: **#54618362**

**Room:** 1-Bedroom Suite (2 Queens) + Kitchen
**Check-in:** 3:00 PM | **Check-out:** 11:00 AM

*Free Hot Breakfast Daily*`,
            order: 1
          }
        ]
      },
      groceries: {
        create: [] // Groceries are handled in suite / purchased at TJ's
      },
      days: {
        create: [
          {
            dayNumber: 1,
            dateLabel: 'Day 1: Thursday, July 16',
            title: 'Arrival & Old Ironsides',
            activities: {
              create: [
                { time: '10:38 AM', description: 'Land at Logan. Uber to Hotel (~15 min). Drop bags at desk.', order: 0 },
                { time: '12:30 PM', description: 'Lunch: Walk to [Bartaco](https://bartaco.com/location/seaport/) or [Shake Shack](https://shakeshack.com/) (Seaport).', order: 1 },
                { time: '02:30 PM', description: '[USS Constitution](https://ussconstitutionmuseum.org/): Take a Water Taxi from Seaport to Charlestown Navy Yard. Tour "Old Ironsides."', order: 2 },
                { time: '04:30 PM', description: 'Grocery Run: [Trader Joe’s](https://locations.traderjoes.com/ma/boston/542/) (44 Thomson Pl). Buy water, snacks, lunch meat, paper lunch bags, frozen dinners.', order: 3 },
                { time: '06:00 PM', description: 'Dinner: In-Suite. Relax and unpack.', order: 4 },
                {
                  time: 'Evening',
                  description: 'Dessert Splurge #1: You Decide!',
                  details: `**Option A:** [Levain Bakery](https://levainbakery.com/) - The massive, gooey Chocolate Chip Walnut Cookie (Seaport).
**Option B:** [J.P. Licks](https://jplicks.com/) - Boston's favorite local ice cream. Lighter and cooler (Seaport).`,
                  order: 5
                },
                { time: '08:30 PM', description: '[Gardner Museum](https://www.gardnermuseum.org/): Open late (until 9pm). Check for courtyard music.', order: 6 }
              ]
            }
          },
          {
            dayNumber: 2,
            dateLabel: 'Day 2: Friday, July 17',
            title: 'Hard Science & Red Sox',
            activities: {
              create: [
                { time: '09:30 AM', description: 'Uber to Museum of Science.', order: 0 },
                { time: '10:00 AM', description: '[Museum of Science](https://www.mos.org/): Use ASTC Card for free entry. (Tip: Pack a disposable lunch in plastic/paper bags to throw away after eating. See the "Theater of Electricity" show.)', order: 1 },
                { time: '03:00 PM', description: 'North End History Walk: Old North Church & Paul Revere Statue.', order: 2 },
                {
                  time: 'Evening',
                  description: 'Dessert Splurge #2: The Cannoli Wars',
                  details: `**Option A:** [Mike’s Pastry](https://www.mikespastry.com/) (The Famous One).
**Option B:** [Modern Pastry](https://modernpastry.com/) (The Authentic One).
*Grab one of each and eat them on the Rose Kennedy Greenway lawn.*`,
                  order: 3
                },
                {
                  time: 'Evening',
                  description: 'EVENT: Red Sox vs. Rays @ Fenway Park',
                  details: `Game Start: 7:10 PM. Dinner: Fenway Franks & Stadium Food.
**Note:** Tickets are in the MLB Ballpark app. Backpacks and multi-compartment bags are strictly prohibited inside the stadium.`,
                  isAlert: true,
                  order: 4
                }
              ]
            }
          },
          {
            dayNumber: 3,
            dateLabel: 'Day 3: Saturday, July 18',
            title: 'Whales & Waffles',
            activities: {
              create: [
                { time: '08:45 AM', description: 'Transport to Whale Watch: Option A (Recommended): Uber/Lyft (~10 mins) to 1 Long Wharf. Option B: Walk (~25 mins) along the Harborwalk.', order: 0 },
                { time: '09:30 AM', description: 'Boarding Begins: Gate 1 - Central Wharf. (Vessel: Asteria, Conf #: i71511149 / 71511146. Note: Bring sweatshirt & motion sickness meds.)', order: 1 },
                { time: '10:00 AM', description: 'Whale Watch Cruise: Depart (Returns 2:00 PM). (Tip: Pack a cooler lunch for the boat.)', order: 2 },
                { time: '02:30 PM', description: '[Freedom Trail](https://www.thefreedomtrail.org/) (Downtown): Faneuil Hall, Old State House, Granary Burying Ground.', order: 3 },
                {
                  time: 'Evening',
                  description: 'Dessert Splurge #3: You Decide!',
                  details: `**Option A:** [Taiyaki NYC](https://taiyakinyc.com/) - Fun Japanese fish-shaped waffle cones with soft serve. (Seaport)
**Option B:** [Boston Cream Pie](https://www.omnihotels.com/hotels/boston-parker-house/dining) - Eat the original at Omni Parker House, right on the Freedom Trail. (Downtown)`,
                  order: 4
                },
                { time: 'Dinner', description: 'In-Suite: Head back to the hotel to cook a simple meal or order takeout.', order: 5 },
                { time: 'Evening', description: 'Comedy Club (TBD): Check Laugh Boston (right in the Seaport) or Improv Asylum (North End) for age-appropriate shows.', order: 6 }
              ]
            }
          },
          {
            dayNumber: 4,
            dateLabel: 'Day 4: Sunday, July 19',
            title: 'Cambridge Brains & Ghosts',
            activities: {
              create: [
                { time: '10:30 AM', description: '[MIT Museum](https://mitmuseum.mit.edu/): Focus on Robotics, AI, and Holography.', order: 0 },
                { time: '01:00 PM', description: 'Lunch: Packed Lunch. Find a spot in Harvard Yard or along the Charles River to eat.', order: 1 },
                { time: '02:30 PM', description: 'Harvard Square: [Harvard Museum of Natural History](https://hmnh.harvard.edu/) (Glass Flowers) & The Coop.', order: 2 },
                {
                  time: 'Evening',
                  description: 'Dessert Splurge #4: You Decide!',
                  details: `**Option A:** [Toscanini’s Ice Cream](https://www.tosci.com/) - "The World's Best Ice Cream" (Famous for B3 flavor). Near MIT.
**Option B:** [L.A. Burdick](https://www.burdickchocolate.com/) - Famous Drinking Chocolate (melted chocolate shavings). Harvard Sq.`,
                  order: 3
                },
                { time: '06:00 PM', description: 'Dinner In-Suite: Cook meal in suite before tour.', order: 4 },
                {
                  time: 'Evening',
                  description: 'EVENT: Ghosts & Gravestones Walking Tour',
                  details: `**Departure:** The Boston Massacre Memorial (206 Washington St).
**Time:** Evening (Check Ticket). **Duration:** 90 Mins (Walking).
*Rated PG-13. Visit two burial grounds and hear true crime/morbid tales.*`,
                  isAlert: true,
                  order: 5
                }
              ]
            }
          },
          {
            dayNumber: 5,
            dateLabel: 'Day 5: Monday, July 20',
            title: 'Aquatic Life & Farewell',
            activities: {
              create: [
                { time: '10:00 AM', description: '[New England Aquarium](https://www.neaq.org/): Walk over the bridge from your hotel. See the Giant Ocean Tank & Octopus.', order: 0 },
                { time: '12:30 PM', description: 'Lunch: [Quincy Market / Faneuil Hall](https://faneuilhallmarketplace.com/) or [Joe\'s Waterfront](https://www.joeswaterfront.com/) (right next to the aquarium).', order: 1 },
                { time: '02:30 PM', description: 'Seaport Fun: [Puttshack](https://www.puttshack.com/locations/boston) (Tech Mini Golf) or walk Harborwalk.', order: 2 },
                { time: 'Dinner', description: 'Farewell: [View Boston](https://viewboston.com/) (Prudential Center) for sunset views OR Shake Shack on the Seaport steps.', order: 3 }
              ]
            }
          },
          {
            dayNumber: 6,
            dateLabel: 'Day 6: Tuesday, July 21',
            title: 'Departure',
            activities: {
              create: [
                { time: '09:00 AM', description: 'Breakfast & Checkout.', order: 0 },
                { time: '09:30 AM', description: 'Uber to Logan Airport (Terminal B).', order: 1 },
                { time: '11:40 AM', description: 'Fly Home (SY252).', order: 2 }
              ]
            }
          }
        ]
      }
    }
  });

  // 3. HAWAII
  await prisma.trip.create({
    data: {
      id: 'hawaii',
      name: 'Hawaii',
      description: 'Our upcoming island adventure. Sun, sand, and exploring the tropics.',
      dates: 'February 9 - February 19, 2027',
      travelers: 'Family of 6 (Kids: 16, 13, 10, 7)',
      status: 'upcoming',
      startDate: new Date('2027-02-09T00:00:00Z'),
      endDate: new Date('2027-02-19T00:00:00Z'),
      tag: 'Island',
      primaryColor: '#2c7a7b',
      accentColor: '#ed8936',
      checklist: {
        create: [
          { text: '9–12 Months Out: Book Flights', category: 'pre-trip', isCompleted: true },
          { text: 'June 2026: Secure Oahu Condo', category: 'pre-trip', isCompleted: true },
          { text: 'June 2026: Secure Big Island Condos', category: 'pre-trip', isCompleted: true },
          { text: 'By August 2026: Reserve Rental Cars', category: 'pre-trip', isCompleted: false },
          { text: 'November 2026: Pre-Flight Logistics (MSP Airport Parking)', category: 'pre-trip', isCompleted: false },
          { text: 'December 2026: Core Reservations (USS Arizona / Diamond Head)', category: 'pre-trip', isCompleted: false },
          { text: '1 Week Out: Download Apps (Instacart, Uber, DaBus2)', category: 'app', isCompleted: false }
        ]
      },
      logistics: {
        create: [
          {
            title: 'Flights (American Airlines - NYMQBM)',
            content: `**Outbound (Feb 9):** MSP (6:32 AM) → DFW (9:38 AM) | DFW (11:20 AM) → HNL (3:55 PM) *(AA 3012 / AA 5)*
**Island Hop (Feb 14):** HNL (1:18 PM) → KOA (2:06 PM) *(AA 7887 / Operated by Hawaiian)*
**Return (Feb 18):** KOA (10:30 PM) → PHX (7:19 AM next day) | PHX (9:40 AM) → MSP (1:46 PM on Feb 19) *(AA 664 / AA 1743)*`,
            order: 0
          },
          {
            title: 'Lodging (VRBO)',
            content: `**Oahu (Feb 9 - Feb 14):** Waikiki Banyan 1BR (Confirmed). Check-in: 3:00 PM. *(VRBO: HA-JC4J4V | Host: Christina Nguyen)*
**Big Island Pt 1 - Volcano (Feb 14 - Feb 16):** Caldera - Hale Kumu La'au (Confirmed). Check-in: 4:00 PM. *(VRBO: HA-RGNTDN | Hosts: Namanu & Jarred)*
**Big Island Pt 2 - Waikoloa (Feb 16 - Feb 18):** Great Community Home (Request Pending). *(VRBO: HA-DPDDH1 | Host: Keoni Hong)*`,
            order: 1
          }
        ]
      },
      groceries: {
        create: [
          { name: 'Spaghetti, Jar Sauce, & Ground Beef (1 lb)', category: 'Oahu Grocery List (Day 1)' },
          { name: 'Ground Beef (2 lbs), Taco Kit, Salsa', category: 'Oahu Grocery List (Day 1)' },
          { name: 'Milk & Cereal', category: 'Oahu Grocery List (Day 1)' },
          { name: 'Bread & PBJ/Deli Meat', category: 'Oahu Grocery List (Day 1)' },
          { name: 'Frozen Pizzas', category: 'Oahu Grocery List (Day 1)' },
          { name: 'Sunscreen & Aloe', category: 'Oahu Essentials' },
          { name: 'Coffee & Filters', category: 'Oahu Essentials' },
          { name: 'Cooking Oil / Butter / Mayo', category: 'Oahu Essentials' },
          { name: '2 Rotisserie Chickens', category: 'Big Island Costco List (Day 6)' },
          { name: 'Burgers/Hot Dogs', category: 'Big Island Costco List (Day 6)' },
          { name: 'Bagged Salads (2 big kits)', category: 'Big Island Costco List (Day 6)' },
          { name: 'Rice (5lb bag)', category: 'Big Island Costco List (Day 6)' },
          { name: 'Eggs (24 pack) & Bacon', category: 'Big Island Costco List (Day 6)' },
          { name: 'Bagels / Deli Meat / Cheese', category: 'Big Island Costco List (Day 6)' },
          { name: 'Poke (Seafood Section)', category: 'Big Island Costco List (Day 6)' },
          { name: 'Soy Sauce (Aloha Shoyu)', category: 'Big Island Pantry Re-Stock' },
          { name: 'Ziploc Bags', category: 'Big Island Pantry Re-Stock' },
          { name: 'Case of Water', category: 'Big Island Pantry Re-Stock' }
        ]
      },
      days: {
        create: [
          {
            dayNumber: 1,
            dateLabel: 'Day 1 (Feb 9): Landing & Waikiki',
            title: 'Oahu Arrival',
            activities: {
              create: [
                { time: '03:55 PM', description: 'Arrive HNL. UberXL to Condo. Check-in.', order: 0 },
                { time: 'Afternoon', description: 'Walk Waikiki Strip. Take photo with Duke Kahanamoku statue.', order: 1 },
                { time: 'Evening', description: 'Grocery Run (Safeway Kapahulu or Instacart).', order: 2 },
                {
                  time: 'Dinner',
                  description: 'Marukame Udon (Handmade noodles, very affordable).',
                  details: 'Daily Treat: Dole Whip at Island Vintage Shave Ice.',
                  order: 3
                }
              ]
            }
          },
          {
            dayNumber: 2,
            dateLabel: 'Day 2 (Feb 10): Pearl Harbor',
            title: 'History',
            activities: {
              create: [
                { time: 'Morning', description: 'Take TheBus (#20 or #42) to Pearl Harbor. Tour USS Arizona Memorial (Book 8 weeks early!).', order: 0 },
                { time: 'Lunch', description: 'Packed Snacks/Sandwiches (eat on the lawn outside the gates).', order: 1 },
                { time: 'Afternoon', description: 'Bonus: Battleship Missouri tickets ($$).', order: 2 },
                { time: 'Evening', description: 'Dinner Condo: Spaghetti Night. Walk to Free Hula Show at Kūhiō Beach (sunset). Treat: Leonard\'s Bakery Malasadas.', order: 3 }
              ]
            }
          },
          {
            dayNumber: 3,
            dateLabel: 'Day 3 (Feb 11): North Shore Loop',
            title: '1-Day Car Rental',
            activities: {
              create: [
                { time: 'Morning', description: 'Shark’s Cove (Snorkel) OR Waimea Valley Botanical Garden (Walk/Swim).', order: 0 },
                { time: 'Lunch', description: 'North Shore Food Trucks (Giovanni’s Shrimp).', order: 1 },
                { time: 'Afternoon', description: 'Dole Plantation Maze & Train. Return via Halona Blowhole scenic drive.', order: 2 },
                { time: 'Evening', description: 'Dinner: Leftovers at condo. Treat: Matsumoto Shave Ice in Haleiwa.', order: 3 }
              ]
            }
          },
          {
            dayNumber: 4,
            dateLabel: 'Day 4 (Feb 12): Hike & Relax',
            title: 'Nature',
            activities: {
              create: [
                { time: 'Morning', description: 'Hike Diamond Head early morning (Book 30 days early!).', order: 0 },
                { time: 'Lunch', description: 'Sandwiches at the beach.', order: 1 },
                { time: 'Afternoon', description: 'Waikiki beach swim & relax.', order: 2 },
                { time: 'Evening', description: 'Dinner Condo: Taco Night! Treat: Kai Coffee (Macadamia Nut Latte).', order: 3 }
              ]
            }
          },
          {
            dayNumber: 5,
            dateLabel: 'Day 5 (Feb 13): Free Day in Oahu',
            title: 'Flex Day',
            activities: {
              create: [
                { time: 'All Day', description: 'Relax by condo pool, rent surfboards, or do souvenir shopping.', order: 0 },
                { time: 'Lunch', description: 'Musubi Cafe Iyasume (Rice balls with Spam/Egg).', order: 1 },
                { time: 'Dinner', description: 'Clean out the condo fridge.', order: 2 }
              ]
            }
          },
          {
            dayNumber: 6,
            dateLabel: 'Day 6 (Feb 14): Island Hop',
            title: 'Travel to Big Island',
            activities: {
              create: [
                { time: '11:00 AM', description: 'Check out of Waikiki Banyan. Fly HNL → KOA (1:18 PM - 2:06 PM).', order: 0 },
                { time: 'Afternoon', description: 'Pick up Minivan. Stop at Costco Kona to stock up for 4 days. Drive to Volcano.', order: 1 },
                { time: '04:00 PM', description: 'Check into Caldera - Hale Kumu La\'au in Volcano.', order: 2 },
                { time: 'Evening', description: 'Dinner: Arrival Feast (Rotisserie Chicken, Caesar Salad, Rice). Treat: Tropical Dreams Ice Cream.', order: 3 }
              ]
            }
          },
          {
            dayNumber: 7,
            dateLabel: 'Day 7 (Feb 15): The Grand Loop',
            title: 'Volcanoes National Park',
            activities: {
              create: [
                { time: 'Morning', description: 'Punaluʻu Black Sand Beach. Walk the sand and look for sea turtles.', order: 0 },
                { time: 'Lunch', description: 'Packed sandwiches at Punaluʻu beach.', order: 1 },
                { time: 'Afternoon', description: 'Hawaiʻi Volcanoes National Park. Hike Kīlauea Iki Trail. Dinner: Cafe 100 in Hilo.', order: 2 },
                { time: 'Evening', description: 'Check out the crater glow after dark. Treat: Big Island Candies in Hilo.', order: 3 }
              ]
            }
          },
          {
            dayNumber: 8,
            dateLabel: 'Day 8 (Feb 16): Transition & Stargazing',
            title: 'Mauna Kea',
            activities: {
              create: [
                { time: 'Morning', description: 'Checkout of Volcano. Drive Saddle Road.', order: 0 },
                { time: 'Afternoon', description: 'Mauna Kea Visitor Center to acclimatize.', order: 1 },
                { time: 'Evening', description: 'Stargazing at Mauna Kea. Drive down to Waikoloa and check in. Dinner: Packed picnic/cocoa.', order: 2 }
              ]
            }
          },
          {
            dayNumber: 9,
            dateLabel: 'Day 9 (Feb 17): History & North Tip',
            title: 'Culture & Adventure',
            activities: {
              create: [
                { time: 'Morning', description: 'Relax at Hapuna Beach. Stop at Puʻukoholā Heiau NHS (Free).', order: 0 },
                {
                  time: 'Afternoon',
                  description: 'Choose Adventure:',
                  details: `**Option A:** Kohala Ziplining ($200/person).
**Option B:** Pololū Valley Hike (Free, wild black sand beach).`,
                  order: 1
                },
                { time: 'Evening', description: 'Dinner Condo: BBQ Burgers. Treat: Tex Drive-In Malasadas.', order: 2 }
              ]
            }
          },
          {
            dayNumber: 10,
            dateLabel: 'Day 10 (Feb 18): The Long Goodbye',
            title: 'Red-Eye Departure',
            activities: {
              create: [
                { time: 'Morning', description: 'Checkout (ask for late checkout). Explore Kona town, souvenirs.', order: 0 },
                { time: 'Lunch', description: 'Poke Bowl or Food Truck.', order: 1 },
                { time: 'Evening', description: 'Sit-down dinner in Kona town. Head to KOA airport for 10:30 PM flight.', order: 2 }
              ]
            }
          }
        ]
      }
    }
  });

  // 4. SIOUX FALLS (SOUL & SAVORY)
  await prisma.trip.create({
    data: {
      id: 'sioux-falls',
      name: 'Soul & Savory (Sioux Falls)',
      description: 'A day dedicated to relaxation, exploration, and the flavors that keep life adventurous.',
      dates: 'Feb 7, 2025',
      travelers: 'Caron & You',
      status: 'past',
      startDate: new Date('2025-02-07T00:00:00Z'),
      endDate: new Date('2025-02-07T00:00:00Z'),
      tag: 'City',
      primaryColor: '#2c3e50',
      accentColor: '#d4a017',
      days: {
        create: [
          {
            dayNumber: 1,
            dateLabel: 'Saturday, February 7th',
            title: 'Sioux Falls Day Trip',
            activities: {
              create: [
                { time: '11:30 AM', description: 'The Creative Fuel (Lunch): Bread & Circus Sandwich Kitchen (600 N Main Ave). Chef-driven sandwiches and bold flavors. Casual vibe.', order: 0 },
                { time: '01:15 PM', description: 'Arrival & Spa Check-in: Radiance Day Spa (6209 S Pinnacle Pl). (Crucial Time: Please arrive promptly to check in.)', isAlert: true, order: 1 },
                { time: '04:30 PM', description: 'The Sweet Indulgence: CH Patisserie (309 S Phillips Ave). World-class macarons and coffee as a post-spa treat before closing at 6 PM.', order: 2 },
                { time: '05:15 PM', description: 'The Twilight Wander: Downtown / Falls Park. Relaxed stroll. Catch sunset lights over the falls. Stop at Zandbroz.', order: 3 },
                { time: '06:30 PM', description: 'The Grand Finale (Dinner): Harvester Kitchen by Bryan (196 E 6th St). Adventurous, multi-course "leap of faith" culinary experience.', order: 4 },
                { time: '09:00 PM', description: 'LEGO Time: Work together to create the LEGO gift at home.', order: 5 }
              ]
            }
          }
        ]
      }
    }
  });

  // 5. SOUTHWEST PARKS
  await prisma.trip.create({
    data: {
      id: 'southwest',
      name: 'Southwest Parks',
      description: 'Our road trip through the Grand Canyon and Zion National Park.',
      dates: 'Archived',
      travelers: 'Family',
      status: 'past',
      startDate: new Date('2024-05-14T00:00:00Z'),
      endDate: new Date('2024-05-23T00:00:00Z'),
      tag: 'National Parks',
      primaryColor: '#2c3e50',
      accentColor: '#3498db',
      days: {
        create: [
          {
            dayNumber: 1,
            dateLabel: 'Archived Trip Details',
            title: 'Details Pending Compilation',
            activities: {
              create: [
                { time: 'Summary', description: 'Details for this past trip are currently being compiled.', order: 0 }
              ]
            }
          }
        ]
      }
    }
  });

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
