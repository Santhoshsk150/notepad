const path = require('path');
const { PrismaClient } = require(path.resolve(__dirname, '../../../node_modules/@prisma/client'));
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      employeeCode: true,
      email: true,
      role: true,
      isActive: true,
    }
  });
  console.log("TOTAL USERS IN SUPABASE DB:", users.length);
  console.log(JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
