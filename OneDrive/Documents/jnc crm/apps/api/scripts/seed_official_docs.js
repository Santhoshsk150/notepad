/* --- C2PA CONTENT CREDENTIALS & PROVENANCE NOTICE ---
 * c2pa.action: 'c2pa.created'
 * c2pa.ai_training: 'disallowed'
 * c2pa.do_not_train: true
 * rights: 'All rights reserved by original author. Automated AI scraping without license is prohibited.'
 * ----------------------------------------------------- */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding sample official documents...');

  // 1. Tax Invoice 002/26-27
  await prisma.invoice.upsert({
    where: { invoiceNumber: '002/26-27' },
    create: {
      invoiceNumber: '002/26-27',
      docType: 'tax_invoice',
      invoiceDate: new Date('2026-04-10'),
      paymentTerms: 'Advance',
      customerName: 'VK Engineering & Services',
      customerPhone: '9848012345',
      customerEmail: 'billing@vkengineering.com',
      customerGstin: '37BEFPC9729G1ZC',
      customerState: 'Andhra Pradesh',
      billingAddress: 'Visakhapatnam - 530041, Andhra Pradesh, India',
      deliveryAddress: 'Visakhapatnam - 530041, Andhra Pradesh, India',
      subtotal: 7010,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 1262,
      totalAmount: 8272,
      paymentStatus: 'paid',
      lines: {
        create: [
          { description: 'RE-102 2 Zone Fire Alarm Panel', hsnCode: '85312000', unit: "No's", quantity: 1, unitPrice: 4500, taxRate: 18, igstRate: 18, igstAmount: 810, lineTotal: 5310 },
          { description: 'RE-326 2SL CE Certified Smoke Detector', hsnCode: '85311020', unit: "No's", quantity: 1, unitPrice: 740, taxRate: 18, igstRate: 18, igstAmount: 133.2, lineTotal: 873.2 },
          { description: 'RE-716 MR Manual Call Point', hsnCode: '85319000', unit: "No's", quantity: 1, unitPrice: 520, taxRate: 18, igstRate: 18, igstAmount: 93.6, lineTotal: 613.6 },
          { description: 'RE-24 CS ABS Sounder 24V95', hsnCode: '85319000', unit: "No's", quantity: 1, unitPrice: 750, taxRate: 18, igstRate: 18, igstAmount: 135, lineTotal: 885 },
          { description: 'Transportation charges', hsnCode: '9965', unit: "No's", quantity: 1, unitPrice: 500, taxRate: 18, igstRate: 18, igstAmount: 90, lineTotal: 590 }
        ]
      }
    },
    update: {}
  });

  // 2. SEZ LUT Tax Invoice 013/25-26
  await prisma.invoice.upsert({
    where: { invoiceNumber: '013/25-26' },
    create: {
      invoiceNumber: '013/25-26',
      docType: 'sez_invoice',
      invoiceDate: new Date('2025-06-04'),
      poDate: new Date('2025-04-25'),
      buyerOrderNo: 'CHZ1HW00001/26',
      paymentTerms: '45 days',
      lutBondNo: 'AD290525013648T',
      lutValidity: 'From : 10/05/2025 To: 09/05/2026',
      isSez: true,
      customerName: 'TATA Elxsi Limited',
      customerPhone: '04466223344',
      customerEmail: 'ap.accounts@tataelxsi.com',
      customerGstin: '33AAACT7872Q2ZM',
      customerState: 'Tamil Nadu',
      billingAddress: 'IG3 Infra Ltd SEZ, 9th Floor, South Block, Ph-2 Chennai One, Pallavaram - Thoraipakkam200 Feet Road, Chennai, Tamilnadu 600097',
      deliveryAddress: 'IG3 Infra Ltd SEZ, 9th Floor, South Block, Ph-2 Chennai One, Pallavaram - Thoraipakkam200 Feet Road, Chennai, Tamilnadu 600097',
      subtotal: 233000,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: 233000,
      paymentStatus: 'paid',
      lines: {
        create: [
          { description: 'Supply of 32 Channel NVR with Raid.\nSL-2411013041000381', hsnCode: '85219090', unit: "No's", quantity: 1, unitPrice: 48200, taxRate: 18, igstRate: 18, igstAmount: 8676, lineTotal: 48200 },
          { description: 'Supply of 10TB Enterprise HDD.\nSL-VH2ARXXM, VH2ARK7M, VH2AS1GM, VH2AY37M,\nVH2AZW2M, VH2AYDNM, VH2B07RM, VH2ARW5M', hsnCode: '83014090', unit: "No's", quantity: 8, unitPrice: 23100, taxRate: 18, igstRate: 18, igstAmount: 33264, lineTotal: 184800 }
        ]
      }
    },
    update: {}
  });

  // 3. Proforma Invoice 006/26-27
  await prisma.invoice.upsert({
    where: { invoiceNumber: '006/26-27' },
    create: {
      invoiceNumber: '006/26-27',
      docType: 'proforma_invoice',
      invoiceDate: new Date('2026-08-11'),
      poDate: new Date('2026-07-05'),
      buyerOrderNo: 'GTS/PO/045/2026-27',
      paymentTerms: 'Advance',
      advancePercent: 50,
      advanceAmount: 122720,
      customerName: 'Globle Tech Solutions',
      customerPhone: '9988776655',
      customerEmail: 'procurement@globletech.in',
      customerGstin: '29DIGPS7421M1ZK',
      customerState: 'Karnataka',
      billingAddress: '#106/P, 3rd Cross Road, Anjaneya Temple Street, Yediyur, Jayanagar 6th Block, Bangalore – 560070',
      deliveryAddress: '#106/P, 3rd Cross Road, Anjaneya Temple Street, Yediyur, Jayanagar 6th Block, Bangalore – 560070',
      subtotal: 208000,
      cgstAmount: 18720,
      sgstAmount: 18720,
      igstAmount: 0,
      totalAmount: 245440,
      paymentStatus: 'partial',
      lines: {
        create: [
          { description: 'Supply of 12 Zone PA controller.\n- 12 zone output (Expandable up to 40 Zones).\n- Priority selection i.e. 1. Announcement 2. Fire Alert 3. Music\n- 1 Emergency Triggers.\n- LED indication to show the status of particular operation chosen.\n- Heart beat LED indication to show the health status of controller.', hsnCode: '85184000', unit: "No's", quantity: 2, unitPrice: 72000, taxRate: 18, cgstRate: 9, cgstAmount: 12960, sgstRate: 9, sgstAmount: 12960, lineTotal: 169920 },
          { description: '240W Amplifier', hsnCode: '85184000', unit: "No's", quantity: 2, unitPrice: 22000, taxRate: 18, cgstRate: 9, cgstAmount: 3960, sgstRate: 9, sgstAmount: 3960, lineTotal: 51920 },
          { description: 'Testing and Commissioning of PA system.', hsnCode: '9987', unit: "No's", quantity: 1, unitPrice: 20000, taxRate: 18, cgstRate: 9, cgstAmount: 1800, sgstRate: 9, sgstAmount: 1800, lineTotal: 23600 }
        ]
      }
    },
    update: {}
  });

  // 4. Delivery Challan 024/26-27
  await prisma.invoice.upsert({
    where: { invoiceNumber: '024/26-27' },
    create: {
      invoiceNumber: '024/26-27',
      docType: 'delivery_challan',
      invoiceDate: new Date('2026-07-27'),
      poDate: new Date('2026-07-13'),
      buyerOrderNo: 'BLNZHW00392/27',
      paymentTerms: 'Immediately',
      customerName: 'Tata Elxsi Limited',
      customerPhone: '08022998877',
      customerEmail: 'stores.blr@tataelxsi.com',
      customerGstin: '29AAACT7872Q1ZP',
      customerState: 'Karnataka',
      billingAddress: 'Unit.II, Sy.No.128/2, Wing 4, Hoodi Village, Mahadevapura PO, Whitefield Road, Bengaluru-560048',
      deliveryAddress: 'Unit.II, Sy.No.128/2, Wing 4, Hoodi Village, Mahadevapura PO, Whitefield Road, Bengaluru-560048',
      subtotal: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: 0,
      paymentStatus: 'paid',
      lines: {
        create: [
          { description: 'Supply of 3 Mtr singla Mode OFC Patch Cords', hsnCode: '-', unit: 'No', quantity: 132, unitPrice: 0, taxRate: 0, lineTotal: 0 }
        ]
      }
    },
    update: {}
  });

  console.log('Seeding completed successfully!');
  await prisma.$disconnect();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
