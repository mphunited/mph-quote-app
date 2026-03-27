/**
 * Vendor configuration – pre-populated defaults for the quote calculator.
 *
 * All prices can be overridden by the salesperson at quote time.
 * usesBottles: false  →  Bottle section is hidden for that vendor.
 * multipleLocations: true → A second dropdown appears to pick the origin city.
 */

export const IBC_DESCRIPTIONS = [
  '275 Gal Rebottle IBC',
  '330 Gal Rebottle IBC',
  '275 Gal Washouts IBC',
  '330 Gal Washouts IBC',
  '275 Gal New IBC',
  '330 Gal New IBC',
  '135 Gal New IBC',
  '55 Gal Drum',
  'Other',
]

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

export const VENDORS = [
  {
    id: 'rrg',
    name: 'RRG (Rural Recycling Grinding)',
    origin: { city: 'Stanwood', state: 'IA' },
    // Buy price is $60 for both 275 and 330 gal
    defaultBuyPrice: 60,
    usesBottles: true,
    // Bottle cost: $58 for 275 gal / $66 for 330 gal — defaults to 275 gal; override as needed
    defaultBottleCost: 58,
    defaultBottleFreightRate: 1100,
    defaultDescriptions: ['275 Gal Rebottle IBC', '330 Gal Rebottle IBC'],
  },
  {
    id: 'sts',
    name: 'STS (Superior Tote Solutions)',
    origin: { city: 'Summitville', state: 'IN' },
    defaultBuyPrice: 140,   // 275 gal rebottle default
    buyPriceByDescription: {
      '275 Gal Rebottle IBC':  140,
      '330 Gal Rebottle IBC':  160,
      '275 Gal Washouts IBC':  110,
    },
    usesBottles: false,
    defaultBottleCost: 0,
    defaultBottleFreightRate: 0,
    defaultDescriptions: ['275 Gal Rebottle IBC', '330 Gal Rebottle IBC', '275 Gal Washouts IBC'],
  },
  {
    id: 'alliance-greenwood',
    name: 'Alliance Container – Greenwood',
    origin: { city: 'Greenwood', state: 'IN' },
    defaultBuyPrice: 0,     // No cage buy price — cost is bottle only
    usesBottles: true,
    // Bottle cost: $58 for 275 gal / $66 for 330 gal — defaults to 275 gal; override as needed
    defaultBottleCost: 58,
    defaultBottleFreightRate: 0,
    defaultDescriptions: ['275 Gal Rebottle IBC', '330 Gal Rebottle IBC'],
  },
  {
    id: 'alliance-hillsboro',
    name: 'Alliance Container – Hillsboro',
    origin: { city: 'Hillsboro', state: 'TX' },
    defaultBuyPrice: 0,     // No cage buy price — cost is bottle only
    usesBottles: true,
    // Bottle cost: $58.50 for 275 gal / $63 for 330 gal — defaults to 275 gal; override as needed
    defaultBottleCost: 58.5,
    defaultBottleFreightRate: 0,
    defaultDescriptions: ['275 Gal Rebottle IBC', '330 Gal Rebottle IBC'],
  },
  {
    id: 'clean-environmental',
    name: 'Clean Environmental',
    origin: { city: 'St. Louis', state: 'MO' },
    defaultBuyPrice: 67.5,  // 275 gal rebottle default
    buyPriceByDescription: {
      '275 Gal Rebottle IBC': 67.5,
      '275 Gal Washouts IBC': 95,
    },
    usesBottles: true,
    defaultBottleCost: 55,
    defaultBottleFreightRate: 895,
    defaultDescriptions: ['275 Gal Rebottle IBC', '275 Gal Washouts IBC'],
  },
  {
    id: 'core-ibcs',
    name: 'Core-IBCS',
    multipleLocations: true,
    locations: [
      { city: 'Houston',      state: 'TX' },
      { city: 'Nashua',       state: 'IA' },
      { city: 'Shreveport',   state: 'LA' },
      { city: 'South Holland',state: 'IL' },
      { city: 'Waterloo',     state: 'IA' },
      { city: 'Calhoun',      state: 'GA' },
    ],
    defaultBuyPrice: 155,
    buyPriceByDescription: {
      '275 Gal New IBC': 155,
      '330 Gal New IBC': 170,
      '135 Gal New IBC': 170,
    },
    usesBottles: false,
    defaultBottleCost: 0,
    defaultBottleFreightRate: 0,
    defaultDescriptions: ['275 Gal New IBC', '330 Gal New IBC', '135 Gal New IBC'],
  },
  {
    id: 'united-container',
    name: 'United Container',
    origin: { city: 'Hillsboro', state: 'TX' },
    defaultBuyPrice: 65,    // 275 gal rebottle default
    buyPriceByDescription: {
      '275 Gal Rebottle IBC': 65,
      '330 Gal Rebottle IBC': 65,
      '275 Gal Washouts IBC': 85,
    },
    usesBottles: true,
    defaultBottleCost: 55,
    defaultBottleFreightRate: 0,
    defaultDescriptions: ['275 Gal Rebottle IBC', '330 Gal Rebottle IBC', '275 Gal Washouts IBC'],
  },
  {
    id: '5star',
    name: '5 Star Industrial Containers',
    origin: { city: 'Bristow', state: 'OK' },
    defaultBuyPrice: 65,    // 275 gal rebottle default
    buyPriceByDescription: {
      '275 Gal Rebottle IBC':  65,
      '330 Gal Rebottle IBC': 165,
      '275 Gal Washouts IBC':  80,
      '330 Gal Washouts IBC': 110,
    },
    usesBottles: true,
    defaultBottleCost: 55,
    defaultBottleFreightRate: 1025,
    defaultDescriptions: ['275 Gal Rebottle IBC', '330 Gal Rebottle IBC', '275 Gal Washouts IBC', '330 Gal Washouts IBC'],
  },
  {
    id: 'gpc',
    name: 'GPC (Great Plains – Garden City)',
    origin: { city: 'Garden City', state: 'KS' },
    defaultBuyPrice: 65,    // 275 gal rebottle default
    buyPriceByDescription: {
      '275 Gal Rebottle IBC': 65,
      '275 Gal Washouts IBC': 90,
    },
    usesBottles: true,
    defaultBottleCost: 55,
    defaultBottleFreightRate: 1335,
    defaultDescriptions: ['275 Gal Rebottle IBC', '275 Gal Washouts IBC'],
  },
  {
    id: 'sec',
    name: 'SEC (SouthEast Container)',
    origin: { city: 'Cleveland', state: 'MS' },
    defaultBuyPrice: 75,    // 275 gal rebottle default
    buyPriceByDescription: {
      '275 Gal Rebottle IBC':  75,
      '330 Gal Rebottle IBC':  88,
      '275 Gal Washouts IBC':  85,
      '330 Gal Washouts IBC': 105,
    },
    usesBottles: true,
    defaultBottleCost: 55,
    defaultBottleFreightRate: 995,   // updated from 1225
    defaultDescriptions: ['275 Gal Rebottle IBC', '330 Gal Rebottle IBC', '275 Gal Washouts IBC', '330 Gal Washouts IBC'],
  },
  {
    id: 'ted-levine',
    name: 'Ted Levine Drum Co',
    origin: { city: 'South El Monte', state: 'CA' },
    defaultBuyPrice: 160,   // 275 gal rebottle default
    buyPriceByDescription: {
      '275 Gal Rebottle IBC': 160,
      '330 Gal Rebottle IBC': 175,
      '275 Gal Washouts IBC': 105,
    },
    usesBottles: false,
    defaultBottleCost: 0,
    defaultBottleFreightRate: 0,
    defaultDescriptions: ['275 Gal Rebottle IBC', '330 Gal Rebottle IBC', '275 Gal Washouts IBC'],
  },
  {
    id: 'ttw',
    name: 'TTW (Texas Tote Works)',
    origin: { city: 'Odessa', state: 'TX' },
    defaultBuyPrice: 85,    // 275 gal washout default
    buyPriceByDescription: {
      '275 Gal Washouts IBC':  85,
      '330 Gal Washouts IBC': 110,
    },
    usesBottles: false,
    defaultBottleCost: 0,
    defaultBottleFreightRate: 0,
    defaultDescriptions: ['275 Gal Washouts IBC', '330 Gal Washouts IBC'],
  },
]

/** Customer list sourced from Tracking MPH Deals – Lists sheet */
export const CUSTOMERS = [
  '5 Star Industrial Containers - Bristow, OK',
  'A1 Rotomold',
  'Achieved Investments',
  'Acid Products Company',
  'Adjuvants',
  'Ag Ingenuity',
  'Ag Spray Equipment',
  'Agpack',
  'AgTank Solutions',
  'Agtegra Cooperative',
  'Alliance Container - Greenwood, IN',
  'Alliance Container - Hillsboro, TX',
  'Apex Drum Company',
  'Arts Milling Service',
  'AU Solutions',
  'Axel Americas',
  'Axel Royal',
  'Barton Solvents',
  'Beck Flavors',
  'BioAg Alliance',
  'BioConsortia',
  'Brandt Consolidated',
  'Brenntag',
  'CHS Inc',
  'Clean Earth Capital',
  'Clean Environmental',
  'Crop Production Services',
  'Custom Agronomics',
  'DeLong\'s Inc',
  'Dow AgroSciences',
  'Ecovyst',
  'Environmental Tectonics',
  'Exacto Inc',
  'Flint Hills Resources',
  'Gavilon',
  'GreenPoint Ag',
  'Helena Agri-Enterprises',
  'Helm Agro',
  'Husker Ag',
  'ISDE - International Supplies',
  'Jungbunzlauer',
  'Key Solutions',
  'Koch Agronomic Services',
  'Land O Lakes',
  'Landmark Cooperative',
  'Leach Company',
  'Loveland Products',
  'MFA Inc',
  'Mid-States Petroleum',
  'Midwest Ag',
  'Morral Companies',
  'Nufarm',
  'Nutrien Ag Solutions',
  'Other',
  'PBI Gordon',
  'Pilot Chemical',
  'Plains Ag',
  'Premier Industries',
  'Pro Farm Group',
  'Reliable Water Services',
  'Rosen\'s Inc',
  'SARIA (North America)',
  'Simplot',
  'Southern States',
  'Specialty Granules',
  'Sunrise Cooperative',
  'Syngenta',
  'TerraVia',
  'Tessenderlo Kerley',
  'The Andersons',
  'Tri-County Ag',
  'Univar Solutions',
  'US Agri-Chemicals',
  'Valutek',
  'Van Waters & Rogers',
  'Verdesian Life Sciences',
  'Winfield United',
  'WinField United',
  'Zeeland Farm Services',
]
