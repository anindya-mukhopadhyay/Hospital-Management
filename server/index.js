import "dotenv/config";
import cors from "cors";
import express from "express";
import { PrismaClient } from "@prisma/client";

const app = express();
const port = Number(process.env.PORT || 4000);
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Add your Supabase PostgreSQL connection string to .env.");
}
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const asNumber = (value) => Number(value);
const decimal = (value) => Number(value || 0);
const round = (value) => Math.round(Number(value) * 100) / 100;

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      const result = await handler(req, res);
      if (!res.headersSent) res.json(result);
    } catch (error) {
      res.status(400).json({ message: error.message || "Request failed" });
    }
  };
}

function mapBill(bill) {
  return {
    ...bill,
    subtotal: decimal(bill.subtotal),
    discountPercent: decimal(bill.discountPercent),
    discountAmount: decimal(bill.discountAmount),
    taxPercent: decimal(bill.taxPercent),
    taxAmount: decimal(bill.taxAmount),
    totalAmount: decimal(bill.totalAmount),
    amountPaid: decimal(bill.amountPaid),
    items: (bill.items || []).map((item) => ({
      ...item,
      quantity: decimal(item.quantity),
      unitCost: decimal(item.unitCost),
      lineTotal: decimal(item.lineTotal)
    }))
  };
}

async function dbBootstrap() {
  const [patients, doctors, treatments, appointments, treatmentRecords, bills, payments] = await Promise.all([
    prisma.patient.findMany({ orderBy: { id: "asc" } }),
    prisma.doctor.findMany({ include: { department: true }, orderBy: { id: "asc" } }),
    prisma.treatmentCatalog.findMany({ orderBy: { code: "asc" } }),
    prisma.appointment.findMany({ orderBy: { appointmentAt: "asc" } }),
    prisma.treatmentRecord.findMany({ orderBy: { treatmentDate: "desc" } }),
    prisma.bill.findMany({ include: { items: true }, orderBy: { billDate: "desc" } }),
    prisma.payment.findMany({ orderBy: { paymentDate: "desc" } })
  ]);

  return {
    mode: "supabase-postgresql",
    patients,
    doctors: doctors.map((doctor) => ({
      ...doctor,
      department: doctor.department.name,
      consultationFee: decimal(doctor.consultationFee)
    })),
    treatments: treatments.map((treatment) => ({
      ...treatment,
      standardCost: decimal(treatment.standardCost)
    })),
    appointments,
    treatmentRecords: treatmentRecords.map((record) => ({
      ...record,
      quantity: decimal(record.quantity),
      unitCost: decimal(record.unitCost)
    })),
    bills: bills.map(mapBill),
    payments: payments.map((payment) => ({ ...payment, amount: decimal(payment.amount) }))
  };
}

app.get("/", (_req, res) => {
  res.json({
    message: "TINT Care+ Hospital API is active and online.",
    status: "healthy",
    database: "Connected to Supabase PostgreSQL"
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    database: "Supabase PostgreSQL via Prisma"
  });
});

app.get(
  "/api/bootstrap",
  asyncRoute(async () => {
    return dbBootstrap();
  })
);

app.post(
  "/api/patients",
  asyncRoute(async (req) => {
    const payload = req.body;
    if (!payload.fullName || !payload.dateOfBirth || !payload.gender || !payload.phone) {
      throw new Error("Full name, date of birth, gender, and phone are required.");
    }

    return prisma.patient.create({
      data: {
        fullName: payload.fullName,
        dateOfBirth: new Date(payload.dateOfBirth),
        gender: payload.gender,
        bloodGroup: payload.bloodGroup || null,
        phone: payload.phone,
        address: payload.address || null,
        emergencyContact: payload.emergencyContact || null
      }
    });
  })
);

app.post(
  "/api/appointments",
  asyncRoute(async (req) => {
    const payload = req.body;
    if (!payload.patientId || !payload.doctorId || !payload.appointmentAt || !payload.reason) {
      throw new Error("Patient, doctor, appointment time, and reason are required.");
    }

    return prisma.appointment.create({
      data: {
        patientId: asNumber(payload.patientId),
        doctorId: asNumber(payload.doctorId),
        appointmentAt: new Date(payload.appointmentAt),
        reason: payload.reason
      }
    });
  })
);

app.post(
  "/api/treatments",
  asyncRoute(async (req) => {
    const payload = req.body;
    if (!payload.appointmentId || !payload.treatmentCode || !payload.diagnosis) {
      throw new Error("Appointment, treatment code, and diagnosis are required.");
    }

    return prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: asNumber(payload.appointmentId) }
      });
      if (!appointment) throw new Error("Appointment not found.");

      const treatment = await tx.treatmentCatalog.findUnique({
        where: { code: payload.treatmentCode }
      });
      if (!treatment) throw new Error("Treatment code not found.");

      const quantity = decimal(payload.quantity || 1);
      const unitCost = decimal(payload.unitCost || treatment.standardCost);
      const subtotal = round(quantity * unitCost);
      const discountPercent = decimal(payload.discountPercent || 0);
      const taxPercent = decimal(payload.taxPercent || 0);
      const discountAmount = round((subtotal * discountPercent) / 100);
      const taxAmount = round(((subtotal - discountAmount) * taxPercent) / 100);
      const totalAmount = round(subtotal - discountAmount + taxAmount);

      const bill = await tx.bill.create({
        data: {
          patientId: appointment.patientId,
          subtotal,
          discountPercent,
          discountAmount,
          taxPercent,
          taxAmount,
          totalAmount,
          amountPaid: 0,
          paymentStatus: "UNPAID",
          notes: "Auto-generated from treatment record"
        }
      });

      const record = await tx.treatmentRecord.create({
        data: {
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          appointmentId: appointment.id,
          treatmentCode: treatment.code,
          diagnosis: payload.diagnosis,
          prescription: payload.prescription || null,
          quantity,
          unitCost,
          billId: bill.id
        }
      });

      await tx.billItem.create({
        data: {
          billId: bill.id,
          treatmentId: record.id,
          description: treatment.description,
          quantity,
          unitCost,
          lineTotal: subtotal
        }
      });

      await tx.appointment.update({
        where: { id: appointment.id },
        data: { status: "COMPLETED" }
      });

      const fullBill = await tx.bill.findUnique({ where: { id: bill.id }, include: { items: true } });
      return { treatmentRecord: record, bill: mapBill(fullBill) };
    });
  })
);

app.post(
  "/api/payments",
  asyncRoute(async (req) => {
    const payload = req.body;
    if (!payload.billId || !payload.amount || !payload.paymentMode) {
      throw new Error("Bill, amount, and payment mode are required.");
    }

    return prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findUnique({ where: { id: asNumber(payload.billId) } });
      if (!bill) throw new Error("Bill not found.");

      const amount = decimal(payload.amount);
      const total = decimal(bill.totalAmount);
      const paid = decimal(bill.amountPaid);
      if (amount <= 0) throw new Error("Payment amount must be greater than zero.");
      if (amount > total - paid) throw new Error("Payment amount is greater than remaining balance.");

      const newPaid = round(paid + amount);
      const status = newPaid >= total ? "PAID" : newPaid > 0 ? "PARTIAL" : "UNPAID";

      const payment = await tx.payment.create({
        data: {
          billId: bill.id,
          amount,
          paymentMode: payload.paymentMode,
          referenceNo: payload.referenceNo || null
        }
      });

      await tx.bill.update({
        where: { id: bill.id },
        data: { amountPaid: newPaid, paymentStatus: status }
      });

      return { ...payment, amount: decimal(payment.amount) };
    });
  })
);

app.patch(
  "/api/appointments/:id/status",
  asyncRoute(async (req) => {
    const id = asNumber(req.params.id);
    const { status, notes } = req.body;
    if (!status || !["SCHEDULED", "COMPLETED", "CANCELLED"].includes(status)) {
      throw new Error("Invalid status.");
    }
    return prisma.appointment.update({
      where: { id },
      data: {
        status,
        ...(notes !== undefined ? { notes } : {})
      }
    });
  })
);

app.patch(
  "/api/appointments/:id/reschedule",
  asyncRoute(async (req) => {
    const id = asNumber(req.params.id);
    const { appointmentAt } = req.body;
    if (!appointmentAt) {
      throw new Error("New appointment date and time is required.");
    }
    return prisma.appointment.update({
      where: { id },
      data: {
        appointmentAt: new Date(appointmentAt)
      }
    });
  })
);

app.post(
  "/api/doctors",
  asyncRoute(async (req) => {
    const payload = req.body;
    if (!payload.fullName || !payload.specialization || !payload.phone || !payload.departmentName) {
      throw new Error("Doctor name, specialization, phone, and department are required.");
    }

    let department = await prisma.department.findUnique({ where: { name: payload.departmentName } });
    if (!department) {
      department = await prisma.department.create({ data: { name: payload.departmentName } });
    }

    return prisma.doctor.create({
      data: {
        departmentId: department.id,
        fullName: payload.fullName,
        specialization: payload.specialization,
        phone: payload.phone,
        email: payload.email || null,
        consultationFee: decimal(payload.consultationFee || 500)
      }
    });
  })
);

app.put(
  "/api/doctors/:id",
  asyncRoute(async (req) => {
    const id = asNumber(req.params.id);
    const payload = req.body;
    if (!payload.fullName || !payload.specialization || !payload.phone || !payload.departmentName) {
      throw new Error("Doctor name, specialization, phone, and department name are required.");
    }

    let department = await prisma.department.findUnique({ where: { name: payload.departmentName } });
    if (!department) {
      department = await prisma.department.create({ data: { name: payload.departmentName } });
    }

    return prisma.doctor.update({
      where: { id },
      data: {
        departmentId: department.id,
        fullName: payload.fullName,
        specialization: payload.specialization,
        phone: payload.phone,
        email: payload.email || null,
        consultationFee: decimal(payload.consultationFee || 500)
      }
    });
  })
);

app.delete(
  "/api/doctors/:id",
  asyncRoute(async (req) => {
    const id = asNumber(req.params.id);
    const appointmentsCount = await prisma.appointment.count({ where: { doctorId: id } });
    const treatmentsCount = await prisma.treatmentRecord.count({ where: { doctorId: id } });
    if (appointmentsCount > 0 || treatmentsCount > 0) {
      throw new Error("Cannot delete specialist. They have active appointments or clinical EMR histories linked to them.");
    }
    return prisma.doctor.delete({ where: { id } });
  })
);

app.listen(port, "0.0.0.0", () => {
  console.log(`Hospital API running at http://0.0.0.0:${port}`);
  console.log("Using Supabase PostgreSQL through Prisma.");
});

