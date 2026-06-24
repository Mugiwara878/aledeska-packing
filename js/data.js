const DEF_BOXES = [
  { id: 'A', name: 'Karton A', l: 31, w: 22, h: 11, maxW: 15, ow: 0.3 },
  { id: 'B', name: 'Karton B', l: 42, w: 32, h: 12, maxW: 20, ow: 0.4 },
  { id: 'C', name: 'Karton C', l: 52, w: 32, h: 17, maxW: 25, ow: 0.5 },
  { id: 'D', name: 'Karton D', l: 57, w: 37, h: 22, maxW: 30, ow: 0.6 },
  { id: 'E', name: 'Karton E', l: 60, w: 40, h: 28, maxW: 30, ow: 0.7 },
  { id: 'F', name: 'Karton F', l: 65, w: 50, h: 40, maxW: 30, ow: 0.9 },
];

const DEF_PRODS = [
  { id: '293097104', sku: 'DES-SZT-002', name: 'Sztorcowa deska debowa L BLOK',       waga: 0.3,  l: 32,   w: 24,   h: 4   },
  { id: '293097519', sku: 'DES-SZT-001', name: 'Debowa deska sztorcowa XL PREMIUM',   waga: 3.1,  l: 40,   w: 30,   h: 4   },
  { id: '293527701', sku: 'DES-SZT-003', name: 'Debowa deska sztorcowa XL',           waga: 3.1,  l: 40,   w: 30,   h: 4   },
  { id: '297264837', sku: 'DES-SZT-004', name: 'Deska sztorcowa XXL Kasia',           waga: 4.7,  l: 48,   w: 29,   h: 4.5 },
  { id: '293097488', sku: 'DES-BUK-001', name: 'Bukowa deska do krojenia XL',         waga: 2.5,  l: 45,   w: 38,   h: 2   },
  { id: '293097371', sku: 'DES-BUK-006', name: 'Deska bukowa XL gladka',              waga: 2.5,  l: 46,   w: 37,   h: 2   },
  { id: '293097147', sku: 'DES-BUK-004', name: 'Duza bukowa deska XXL',               waga: 5.0,  l: 50,   w: 35,   h: 4   },
  { id: '293097126', sku: 'DES-DEB-002', name: 'Debowa deska do krojenia pieczywa',   waga: 1.2,  l: 30,   w: 24,   h: 2.5 },
  { id: '295939225', sku: 'DES-DEB-005', name: 'Deska do krojenia chleba Krysia',     waga: 0.96, l: 24.5, w: 34.5, h: 2   },
  { id: '295946291', sku: 'DES-ORZ-001', name: 'Deska z drewna orzechowego Ola',      waga: 1.5,  l: 44,   w: 23.5, h: 2.5 },
  { id: '293097381', sku: 'DES-JES-002', name: 'Jesionowa stolnica XL',               waga: 3.0,  l: 60,   w: 40,   h: 1.5 },
  { id: '293097386', sku: 'DES-JES-001', name: 'Jesionowa stolnica XXL',              waga: 4.5,  l: 70,   w: 49,   h: 1.5 },
  { id: '293097135', sku: 'AKC-004',     name: 'Debowa podstawka TERMIC',             waga: 0.6,  l: 18,   w: 18,   h: 1.5 },
  { id: '293097099', sku: 'AKC-002',     name: 'Pokladki kawowe PUZZLE',              waga: 0.3,  l: 17,   w: 17,   h: 2   },
  { id: '293097091', sku: 'AKC-001',     name: 'Naturalny olej do pielegnacji 250ml', waga: 0.3,  l: 4.5,  w: 4.5,  h: 21.5},
  { id: '293097426', sku: 'AKC-015',     name: 'Zestaw orzechowych tac',              waga: 3.0,  l: 40,   w: 30,   h: 10  },
  { id: '293097120', sku: 'AKC-003',     name: 'Bukowy stolik sniadaniowy',           waga: 4.0,  l: 55,   w: 35,   h: 25  },
  { id: '295949159', sku: 'AKC-028',     name: 'Tluczek do miesa bukowy',             waga: 0.3,  l: 29.5, w: 10.5, h: 4.5 },
];

const PROD_COLORS_HEX = [
  0x185FA5, 0x1D9E75, 0xD85A30, 0xBA7517,
  0x993556, 0x534AB7, 0x3B6D11, 0xA32D2D,
];

const PROD_COLORS_CSS = [
  '#185FA5', '#1D9E75', '#D85A30', '#BA7517',
  '#993556', '#534AB7', '#3B6D11', '#A32D2D',
];
