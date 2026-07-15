import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.payment.deleteMany();
  await prisma.billItem.deleteMany();
  await prisma.treatmentRecord.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.treatmentCatalog.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.department.deleteMany();

  const general = await prisma.department.create({ data: { name: "General Medicine" } });
  const cardio = await prisma.department.create({ data: { name: "Cardiology" } });
  const ortho = await prisma.department.create({ data: { name: "Orthopedics" } });

  await prisma.doctor.createMany({
    data: [
      {
        id: 101,
        departmentId: cardio.id,
        fullName: "Dr. Meera Sharma",
        specialization: "Cardiologist",
        phone: "9876543210",
        email: "meera.sharma@carepulse.example",
        consultationFee: 800
      },
      {
        id: 102,
        departmentId: ortho.id,
        fullName: "Dr. Arjun Nair",
        specialization: "Orthopedic Surgeon",
        phone: "9876501234",
        email: "arjun.nair@carepulse.example",
        consultationFee: 700
      },
      {
        id: 103,
        departmentId: general.id,
        fullName: "Dr. Riya Sen",
        specialization: "General Physician",
        phone: "9876505678",
        email: "riya.sen@carepulse.example",
        consultationFee: 500
      }
    ]
  });

  await prisma.treatmentCatalog.createMany({
    data: [
      { code: "CONSULT", description: "Doctor Consultation", standardCost: 500 },
      { code: "ECG", description: "Electrocardiogram", standardCost: 1200 },
      { code: "XRAY", description: "X-Ray Scan", standardCost: 900 },
      { code: "BLOOD", description: "Blood Test Panel", standardCost: 650 },
      { code: "PHYSIO", description: "Physiotherapy Session", standardCost: 1100 }
    ]
  });

  await prisma.patient.createMany({
    data: [
      {
        id: 1001,
        fullName: "Rahul Verma",
        dateOfBirth: new Date("1992-04-10"),
        gender: "MALE",
        bloodGroup: "B+",
        phone: "9999900000",
        address: "12 Park Street",
        emergencyContact: "Anita Verma - 9999911111"
      },
      {
        id: 1002,
        fullName: "Maya Das",
        dateOfBirth: new Date("1987-11-24"),
        gender: "FEMALE",
        bloodGroup: "O+",
        phone: "9988801122",
        address: "Salt Lake Sector V",
        emergencyContact: "Rohit Das - 9988801133"
      }
    ]
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
