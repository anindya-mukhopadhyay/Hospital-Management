SET SERVEROUTPUT ON;

PROMPT Dropping old Hospital Patient Management objects...

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE payments CASCADE CONSTRAINTS PURGE';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE bill_items CASCADE CONSTRAINTS PURGE';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE treatment_records CASCADE CONSTRAINTS PURGE';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE bills CASCADE CONSTRAINTS PURGE';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE appointments CASCADE CONSTRAINTS PURGE';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE treatment_catalog CASCADE CONSTRAINTS PURGE';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE doctors CASCADE CONSTRAINTS PURGE';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE patients CASCADE CONSTRAINTS PURGE';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE departments CASCADE CONSTRAINTS PURGE';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE != -942 THEN RAISE; END IF;
END;
/

BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE seq_patient'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -2289 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE seq_appointment'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -2289 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE seq_treatment'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -2289 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE seq_bill'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -2289 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE seq_bill_item'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -2289 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP SEQUENCE seq_payment'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -2289 THEN RAISE; END IF; END;
/

PROMPT Creating tables...

CREATE TABLE departments (
    department_id   NUMBER(6) PRIMARY KEY,
    department_name VARCHAR2(80) NOT NULL UNIQUE
);

CREATE TABLE patients (
    patient_id        NUMBER(10) PRIMARY KEY,
    full_name         VARCHAR2(100) NOT NULL,
    date_of_birth     DATE NOT NULL,
    gender            VARCHAR2(10) NOT NULL,
    blood_group       VARCHAR2(5),
    phone             VARCHAR2(20) NOT NULL,
    address           VARCHAR2(250),
    emergency_contact VARCHAR2(100),
    created_at        DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT chk_patient_gender CHECK (gender IN ('MALE', 'FEMALE', 'OTHER'))
);

CREATE TABLE doctors (
    doctor_id        NUMBER(10) PRIMARY KEY,
    department_id    NUMBER(6) NOT NULL,
    full_name        VARCHAR2(100) NOT NULL,
    specialization   VARCHAR2(100) NOT NULL,
    phone            VARCHAR2(20) NOT NULL,
    email            VARCHAR2(100),
    consultation_fee NUMBER(10,2) DEFAULT 0 NOT NULL,
    active_status    CHAR(1) DEFAULT 'Y' NOT NULL,
    CONSTRAINT fk_doctor_department
        FOREIGN KEY (department_id) REFERENCES departments(department_id),
    CONSTRAINT chk_doctor_active CHECK (active_status IN ('Y', 'N')),
    CONSTRAINT chk_doctor_fee CHECK (consultation_fee >= 0)
);

CREATE TABLE treatment_catalog (
    treatment_code VARCHAR2(20) PRIMARY KEY,
    description    VARCHAR2(150) NOT NULL,
    standard_cost  NUMBER(10,2) NOT NULL,
    active_status  CHAR(1) DEFAULT 'Y' NOT NULL,
    CONSTRAINT chk_catalog_cost CHECK (standard_cost >= 0),
    CONSTRAINT chk_catalog_active CHECK (active_status IN ('Y', 'N'))
);

CREATE TABLE appointments (
    appointment_id NUMBER(10) PRIMARY KEY,
    patient_id     NUMBER(10) NOT NULL,
    doctor_id      NUMBER(10) NOT NULL,
    appointment_at DATE NOT NULL,
    status         VARCHAR2(20) DEFAULT 'SCHEDULED' NOT NULL,
    reason         VARCHAR2(250),
    notes          VARCHAR2(250),
    created_at     DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT fk_appointment_patient
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    CONSTRAINT fk_appointment_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    CONSTRAINT uq_doctor_appointment_time UNIQUE (doctor_id, appointment_at),
    CONSTRAINT chk_appointment_status
        CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED'))
);

CREATE TABLE bills (
    bill_id          NUMBER(10) PRIMARY KEY,
    patient_id       NUMBER(10) NOT NULL,
    bill_date        DATE DEFAULT SYSDATE NOT NULL,
    subtotal         NUMBER(10,2) DEFAULT 0 NOT NULL,
    discount_percent NUMBER(5,2) DEFAULT 0 NOT NULL,
    discount_amount  NUMBER(10,2) DEFAULT 0 NOT NULL,
    tax_percent      NUMBER(5,2) DEFAULT 0 NOT NULL,
    tax_amount       NUMBER(10,2) DEFAULT 0 NOT NULL,
    total_amount     NUMBER(10,2) DEFAULT 0 NOT NULL,
    amount_paid      NUMBER(10,2) DEFAULT 0 NOT NULL,
    payment_status   VARCHAR2(20) DEFAULT 'UNPAID' NOT NULL,
    notes            VARCHAR2(250),
    CONSTRAINT fk_bill_patient
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    CONSTRAINT chk_bill_numbers CHECK (
        subtotal >= 0
        AND discount_percent >= 0
        AND discount_amount >= 0
        AND tax_percent >= 0
        AND tax_amount >= 0
        AND total_amount >= 0
        AND amount_paid >= 0
    ),
    CONSTRAINT chk_bill_status CHECK (payment_status IN ('UNPAID', 'PARTIAL', 'PAID'))
);

CREATE TABLE treatment_records (
    treatment_id   NUMBER(10) PRIMARY KEY,
    patient_id      NUMBER(10) NOT NULL,
    doctor_id       NUMBER(10) NOT NULL,
    appointment_id  NUMBER(10),
    treatment_code  VARCHAR2(20) NOT NULL,
    diagnosis       VARCHAR2(500) NOT NULL,
    prescription    VARCHAR2(500),
    treatment_date  DATE DEFAULT SYSDATE NOT NULL,
    quantity        NUMBER(8,2) DEFAULT 1 NOT NULL,
    unit_cost       NUMBER(10,2) NOT NULL,
    bill_id         NUMBER(10),
    CONSTRAINT fk_treatment_patient
        FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    CONSTRAINT fk_treatment_doctor
        FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    CONSTRAINT fk_treatment_appointment
        FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id),
    CONSTRAINT fk_treatment_catalog
        FOREIGN KEY (treatment_code) REFERENCES treatment_catalog(treatment_code),
    CONSTRAINT fk_treatment_bill
        FOREIGN KEY (bill_id) REFERENCES bills(bill_id),
    CONSTRAINT chk_treatment_qty CHECK (quantity > 0),
    CONSTRAINT chk_treatment_cost CHECK (unit_cost >= 0)
);

CREATE TABLE bill_items (
    bill_item_id NUMBER(10) PRIMARY KEY,
    bill_id      NUMBER(10) NOT NULL,
    treatment_id NUMBER(10) NOT NULL,
    description  VARCHAR2(150) NOT NULL,
    quantity     NUMBER(8,2) NOT NULL,
    unit_cost    NUMBER(10,2) NOT NULL,
    line_total   NUMBER(10,2) NOT NULL,
    CONSTRAINT fk_bill_item_bill
        FOREIGN KEY (bill_id) REFERENCES bills(bill_id),
    CONSTRAINT fk_bill_item_treatment
        FOREIGN KEY (treatment_id) REFERENCES treatment_records(treatment_id),
    CONSTRAINT uq_bill_item_treatment UNIQUE (treatment_id),
    CONSTRAINT chk_bill_item_numbers CHECK (quantity > 0 AND unit_cost >= 0 AND line_total >= 0)
);

CREATE TABLE payments (
    payment_id   NUMBER(10) PRIMARY KEY,
    bill_id      NUMBER(10) NOT NULL,
    amount       NUMBER(10,2) NOT NULL,
    payment_date DATE DEFAULT SYSDATE NOT NULL,
    payment_mode VARCHAR2(20) NOT NULL,
    reference_no VARCHAR2(80),
    CONSTRAINT fk_payment_bill
        FOREIGN KEY (bill_id) REFERENCES bills(bill_id),
    CONSTRAINT chk_payment_amount CHECK (amount > 0),
    CONSTRAINT chk_payment_mode CHECK (payment_mode IN ('CASH', 'CARD', 'UPI', 'INSURANCE'))
);

CREATE SEQUENCE seq_patient START WITH 1001 INCREMENT BY 1;
CREATE SEQUENCE seq_appointment START WITH 5001 INCREMENT BY 1;
CREATE SEQUENCE seq_treatment START WITH 7001 INCREMENT BY 1;
CREATE SEQUENCE seq_bill START WITH 9001 INCREMENT BY 1;
CREATE SEQUENCE seq_bill_item START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE seq_payment START WITH 1 INCREMENT BY 1;

PROMPT Creating functions...

CREATE OR REPLACE FUNCTION fn_patient_age (
    p_patient_id IN patients.patient_id%TYPE
) RETURN NUMBER
IS
    v_dob patients.date_of_birth%TYPE;
BEGIN
    SELECT date_of_birth
    INTO v_dob
    FROM patients
    WHERE patient_id = p_patient_id;

    RETURN TRUNC(MONTHS_BETWEEN(SYSDATE, v_dob) / 12);
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20001, 'Patient not found for id ' || p_patient_id);
END;
/

CREATE OR REPLACE FUNCTION fn_bill_total (
    p_bill_id IN bills.bill_id%TYPE
) RETURN NUMBER
IS
    v_discount_percent bills.discount_percent%TYPE;
    v_tax_percent      bills.tax_percent%TYPE;
    v_subtotal         NUMBER(10,2);
    v_discount_amount  NUMBER(10,2);
    v_tax_amount       NUMBER(10,2);
BEGIN
    SELECT discount_percent, tax_percent
    INTO v_discount_percent, v_tax_percent
    FROM bills
    WHERE bill_id = p_bill_id;

    SELECT NVL(SUM(line_total), 0)
    INTO v_subtotal
    FROM bill_items
    WHERE bill_id = p_bill_id;

    v_discount_amount := ROUND(v_subtotal * v_discount_percent / 100, 2);
    v_tax_amount := ROUND((v_subtotal - v_discount_amount) * v_tax_percent / 100, 2);

    RETURN ROUND(v_subtotal - v_discount_amount + v_tax_amount, 2);
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20002, 'Bill not found for id ' || p_bill_id);
END;
/

CREATE OR REPLACE FUNCTION fn_patient_balance (
    p_patient_id IN patients.patient_id%TYPE
) RETURN NUMBER
IS
    v_balance NUMBER(10,2);
BEGIN
    SELECT NVL(SUM(total_amount - amount_paid), 0)
    INTO v_balance
    FROM bills
    WHERE patient_id = p_patient_id;

    RETURN ROUND(v_balance, 2);
END;
/

PROMPT Creating procedures...

CREATE OR REPLACE PROCEDURE pr_add_patient (
    p_full_name         IN patients.full_name%TYPE,
    p_date_of_birth     IN patients.date_of_birth%TYPE,
    p_gender            IN patients.gender%TYPE,
    p_phone             IN patients.phone%TYPE,
    p_patient_id        OUT patients.patient_id%TYPE,
    p_blood_group       IN patients.blood_group%TYPE DEFAULT NULL,
    p_address           IN patients.address%TYPE DEFAULT NULL,
    p_emergency_contact IN patients.emergency_contact%TYPE DEFAULT NULL
)
IS
BEGIN
    SAVEPOINT add_patient_start;

    IF p_date_of_birth > SYSDATE THEN
        RAISE_APPLICATION_ERROR(-20003, 'Date of birth cannot be in the future.');
    END IF;

    IF UPPER(p_gender) NOT IN ('MALE', 'FEMALE', 'OTHER') THEN
        RAISE_APPLICATION_ERROR(-20004, 'Gender must be MALE, FEMALE, or OTHER.');
    END IF;

    p_patient_id := seq_patient.NEXTVAL;

    INSERT INTO patients (
        patient_id,
        full_name,
        date_of_birth,
        gender,
        blood_group,
        phone,
        address,
        emergency_contact
    ) VALUES (
        p_patient_id,
        INITCAP(TRIM(p_full_name)),
        p_date_of_birth,
        UPPER(p_gender),
        UPPER(p_blood_group),
        p_phone,
        p_address,
        p_emergency_contact
    );
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK TO add_patient_start;
        IF SQLCODE BETWEEN -20999 AND -20000 THEN
            RAISE;
        END IF;
        RAISE_APPLICATION_ERROR(-20005, 'Could not add patient: ' || SQLERRM);
END;
/

CREATE OR REPLACE PROCEDURE pr_schedule_appointment (
    p_patient_id     IN appointments.patient_id%TYPE,
    p_doctor_id      IN appointments.doctor_id%TYPE,
    p_appointment_at IN appointments.appointment_at%TYPE,
    p_reason         IN appointments.reason%TYPE,
    p_appointment_id OUT appointments.appointment_id%TYPE
)
IS
    v_count NUMBER;
BEGIN
    SAVEPOINT schedule_appointment_start;

    SELECT COUNT(*)
    INTO v_count
    FROM patients
    WHERE patient_id = p_patient_id;

    IF v_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20006, 'Cannot schedule appointment. Patient does not exist.');
    END IF;

    SELECT COUNT(*)
    INTO v_count
    FROM doctors
    WHERE doctor_id = p_doctor_id
      AND active_status = 'Y';

    IF v_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20007, 'Cannot schedule appointment. Doctor does not exist or is inactive.');
    END IF;

    IF p_appointment_at < SYSDATE THEN
        RAISE_APPLICATION_ERROR(-20008, 'Cannot schedule an appointment in the past.');
    END IF;

    p_appointment_id := seq_appointment.NEXTVAL;

    INSERT INTO appointments (
        appointment_id,
        patient_id,
        doctor_id,
        appointment_at,
        reason
    ) VALUES (
        p_appointment_id,
        p_patient_id,
        p_doctor_id,
        p_appointment_at,
        p_reason
    );
EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
        ROLLBACK TO schedule_appointment_start;
        RAISE_APPLICATION_ERROR(-20009, 'Doctor already has an appointment at that time.');
    WHEN OTHERS THEN
        ROLLBACK TO schedule_appointment_start;
        IF SQLCODE BETWEEN -20999 AND -20000 THEN
            RAISE;
        END IF;
        RAISE_APPLICATION_ERROR(-20010, 'Could not schedule appointment: ' || SQLERRM);
END;
/

CREATE OR REPLACE PROCEDURE pr_generate_bill (
    p_patient_id        IN bills.patient_id%TYPE,
    p_bill_id           OUT bills.bill_id%TYPE,
    p_discount_percent  IN bills.discount_percent%TYPE DEFAULT 0,
    p_tax_percent       IN bills.tax_percent%TYPE DEFAULT 5
)
IS
    v_patient_exists   NUMBER;
    v_item_count       NUMBER := 0;
    v_subtotal         NUMBER(10,2) := 0;
    v_discount_amount  NUMBER(10,2) := 0;
    v_tax_amount       NUMBER(10,2) := 0;
    v_total_amount     NUMBER(10,2) := 0;
BEGIN
    SAVEPOINT generate_bill_start;

    IF NVL(p_discount_percent, 0) < 0 OR NVL(p_tax_percent, 0) < 0 THEN
        RAISE_APPLICATION_ERROR(-20011, 'Discount and tax percentages cannot be negative.');
    END IF;

    SELECT COUNT(*)
    INTO v_patient_exists
    FROM patients
    WHERE patient_id = p_patient_id;

    IF v_patient_exists = 0 THEN
        RAISE_APPLICATION_ERROR(-20012, 'Cannot generate bill. Patient does not exist.');
    END IF;

    p_bill_id := seq_bill.NEXTVAL;

    INSERT INTO bills (
        bill_id,
        patient_id,
        discount_percent,
        tax_percent,
        notes
    ) VALUES (
        p_bill_id,
        p_patient_id,
        NVL(p_discount_percent, 0),
        NVL(p_tax_percent, 0),
        'Auto-generated from unbilled treatment records'
    );

    FOR rec IN (
        SELECT
            tr.treatment_id,
            tc.description,
            tr.quantity,
            tr.unit_cost,
            ROUND(tr.quantity * tr.unit_cost, 2) AS line_total
        FROM treatment_records tr
        JOIN treatment_catalog tc
            ON tc.treatment_code = tr.treatment_code
        WHERE tr.patient_id = p_patient_id
          AND tr.bill_id IS NULL
        ORDER BY tr.treatment_date, tr.treatment_id
    )
    LOOP
        INSERT INTO bill_items (
            bill_item_id,
            bill_id,
            treatment_id,
            description,
            quantity,
            unit_cost,
            line_total
        ) VALUES (
            seq_bill_item.NEXTVAL,
            p_bill_id,
            rec.treatment_id,
            rec.description,
            rec.quantity,
            rec.unit_cost,
            rec.line_total
        );

        UPDATE treatment_records
        SET bill_id = p_bill_id
        WHERE treatment_id = rec.treatment_id;

        v_subtotal := v_subtotal + rec.line_total;
        v_item_count := v_item_count + 1;
    END LOOP;

    IF v_item_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20013, 'No unbilled treatment records found for this patient.');
    END IF;

    v_discount_amount := ROUND(v_subtotal * NVL(p_discount_percent, 0) / 100, 2);
    v_tax_amount := ROUND((v_subtotal - v_discount_amount) * NVL(p_tax_percent, 0) / 100, 2);
    v_total_amount := ROUND(v_subtotal - v_discount_amount + v_tax_amount, 2);

    UPDATE bills
    SET subtotal = v_subtotal,
        discount_amount = v_discount_amount,
        tax_amount = v_tax_amount,
        total_amount = v_total_amount,
        payment_status = 'UNPAID'
    WHERE bill_id = p_bill_id;
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK TO generate_bill_start;
        IF SQLCODE BETWEEN -20999 AND -20000 THEN
            RAISE;
        END IF;
        RAISE_APPLICATION_ERROR(-20014, 'Could not generate bill: ' || SQLERRM);
END;
/

CREATE OR REPLACE PROCEDURE pr_record_treatment (
    p_patient_id         IN treatment_records.patient_id%TYPE,
    p_doctor_id          IN treatment_records.doctor_id%TYPE,
    p_treatment_code     IN treatment_records.treatment_code%TYPE,
    p_diagnosis          IN treatment_records.diagnosis%TYPE,
    p_prescription       IN treatment_records.prescription%TYPE,
    p_treatment_id       OUT treatment_records.treatment_id%TYPE,
    p_bill_id            OUT bills.bill_id%TYPE,
    p_appointment_id     IN treatment_records.appointment_id%TYPE DEFAULT NULL,
    p_quantity           IN treatment_records.quantity%TYPE DEFAULT 1,
    p_unit_cost          IN treatment_records.unit_cost%TYPE DEFAULT NULL,
    p_discount_percent   IN bills.discount_percent%TYPE DEFAULT 0,
    p_tax_percent        IN bills.tax_percent%TYPE DEFAULT 5
)
IS
    v_count     NUMBER;
    v_unit_cost treatment_records.unit_cost%TYPE;
BEGIN
    SAVEPOINT record_treatment_start;

    IF NVL(p_quantity, 0) <= 0 THEN
        RAISE_APPLICATION_ERROR(-20015, 'Treatment quantity must be greater than zero.');
    END IF;

    SELECT COUNT(*)
    INTO v_count
    FROM patients
    WHERE patient_id = p_patient_id;

    IF v_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20016, 'Cannot record treatment. Patient does not exist.');
    END IF;

    SELECT COUNT(*)
    INTO v_count
    FROM doctors
    WHERE doctor_id = p_doctor_id
      AND active_status = 'Y';

    IF v_count = 0 THEN
        RAISE_APPLICATION_ERROR(-20017, 'Cannot record treatment. Doctor does not exist or is inactive.');
    END IF;

    SELECT NVL(p_unit_cost, standard_cost)
    INTO v_unit_cost
    FROM treatment_catalog
    WHERE treatment_code = UPPER(p_treatment_code)
      AND active_status = 'Y';

    IF v_unit_cost < 0 THEN
        RAISE_APPLICATION_ERROR(-20018, 'Treatment cost cannot be negative.');
    END IF;

    IF p_appointment_id IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_count
        FROM appointments
        WHERE appointment_id = p_appointment_id
          AND patient_id = p_patient_id
          AND doctor_id = p_doctor_id
          AND status <> 'CANCELLED';

        IF v_count = 0 THEN
            RAISE_APPLICATION_ERROR(-20019, 'Appointment does not match patient and doctor, or it was cancelled.');
        END IF;
    END IF;

    p_treatment_id := seq_treatment.NEXTVAL;

    INSERT INTO treatment_records (
        treatment_id,
        patient_id,
        doctor_id,
        appointment_id,
        treatment_code,
        diagnosis,
        prescription,
        quantity,
        unit_cost
    ) VALUES (
        p_treatment_id,
        p_patient_id,
        p_doctor_id,
        p_appointment_id,
        UPPER(p_treatment_code),
        p_diagnosis,
        p_prescription,
        p_quantity,
        v_unit_cost
    );

    IF p_appointment_id IS NOT NULL THEN
        UPDATE appointments
        SET status = 'COMPLETED'
        WHERE appointment_id = p_appointment_id;
    END IF;

    pr_generate_bill(
        p_patient_id => p_patient_id,
        p_bill_id => p_bill_id,
        p_discount_percent => p_discount_percent,
        p_tax_percent => p_tax_percent
    );
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        ROLLBACK TO record_treatment_start;
        RAISE_APPLICATION_ERROR(-20020, 'Treatment code does not exist or is inactive.');
    WHEN OTHERS THEN
        ROLLBACK TO record_treatment_start;
        IF SQLCODE BETWEEN -20999 AND -20000 THEN
            RAISE;
        END IF;
        RAISE_APPLICATION_ERROR(-20021, 'Could not record treatment: ' || SQLERRM);
END;
/

CREATE OR REPLACE PROCEDURE pr_pay_bill (
    p_bill_id      IN bills.bill_id%TYPE,
    p_amount       IN payments.amount%TYPE,
    p_payment_mode IN payments.payment_mode%TYPE,
    p_reference_no IN payments.reference_no%TYPE DEFAULT NULL
)
IS
    v_total_amount bills.total_amount%TYPE;
    v_amount_paid  bills.amount_paid%TYPE;
    v_new_paid     bills.amount_paid%TYPE;
BEGIN
    SAVEPOINT pay_bill_start;

    IF p_amount <= 0 THEN
        RAISE_APPLICATION_ERROR(-20022, 'Payment amount must be greater than zero.');
    END IF;

    SELECT total_amount, amount_paid
    INTO v_total_amount, v_amount_paid
    FROM bills
    WHERE bill_id = p_bill_id
    FOR UPDATE;

    IF UPPER(p_payment_mode) NOT IN ('CASH', 'CARD', 'UPI', 'INSURANCE') THEN
        RAISE_APPLICATION_ERROR(-20023, 'Payment mode must be CASH, CARD, UPI, or INSURANCE.');
    END IF;

    IF p_amount > (v_total_amount - v_amount_paid) THEN
        RAISE_APPLICATION_ERROR(-20024, 'Payment amount is greater than remaining balance.');
    END IF;

    INSERT INTO payments (
        payment_id,
        bill_id,
        amount,
        payment_mode,
        reference_no
    ) VALUES (
        seq_payment.NEXTVAL,
        p_bill_id,
        p_amount,
        UPPER(p_payment_mode),
        p_reference_no
    );

    v_new_paid := v_amount_paid + p_amount;

    UPDATE bills
    SET amount_paid = v_new_paid,
        payment_status = CASE
            WHEN v_new_paid = 0 THEN 'UNPAID'
            WHEN v_new_paid < total_amount THEN 'PARTIAL'
            ELSE 'PAID'
        END
    WHERE bill_id = p_bill_id;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        ROLLBACK TO pay_bill_start;
        RAISE_APPLICATION_ERROR(-20025, 'Bill not found for id ' || p_bill_id);
    WHEN OTHERS THEN
        ROLLBACK TO pay_bill_start;
        IF SQLCODE BETWEEN -20999 AND -20000 THEN
            RAISE;
        END IF;
        RAISE_APPLICATION_ERROR(-20026, 'Could not record payment: ' || SQLERRM);
END;
/

CREATE OR REPLACE PROCEDURE pr_print_bill (
    p_bill_id IN bills.bill_id%TYPE
)
IS
    v_patient_name patients.full_name%TYPE;
    v_bill         bills%ROWTYPE;
BEGIN
    SELECT
        b.bill_id,
        b.patient_id,
        b.bill_date,
        b.subtotal,
        b.discount_percent,
        b.discount_amount,
        b.tax_percent,
        b.tax_amount,
        b.total_amount,
        b.amount_paid,
        b.payment_status,
        b.notes,
        p.full_name
    INTO
        v_bill.bill_id,
        v_bill.patient_id,
        v_bill.bill_date,
        v_bill.subtotal,
        v_bill.discount_percent,
        v_bill.discount_amount,
        v_bill.tax_percent,
        v_bill.tax_amount,
        v_bill.total_amount,
        v_bill.amount_paid,
        v_bill.payment_status,
        v_bill.notes,
        v_patient_name
    FROM bills b
    JOIN patients p
        ON p.patient_id = b.patient_id
    WHERE b.bill_id = p_bill_id;

    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
    DBMS_OUTPUT.PUT_LINE('HOSPITAL PATIENT MANAGEMENT BILL');
    DBMS_OUTPUT.PUT_LINE('Bill ID     : ' || v_bill.bill_id);
    DBMS_OUTPUT.PUT_LINE('Patient     : ' || v_patient_name || ' (ID ' || v_bill.patient_id || ')');
    DBMS_OUTPUT.PUT_LINE('Bill Date   : ' || TO_CHAR(v_bill.bill_date, 'DD-MON-YYYY HH24:MI'));
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');

    FOR item IN (
        SELECT description, quantity, unit_cost, line_total
        FROM bill_items
        WHERE bill_id = p_bill_id
        ORDER BY bill_item_id
    )
    LOOP
        DBMS_OUTPUT.PUT_LINE(
            RPAD(item.description, 22)
            || ' Qty: ' || TO_CHAR(item.quantity)
            || ' Rate: ' || TO_CHAR(item.unit_cost, '9999990.00')
            || ' Total: ' || TO_CHAR(item.line_total, '9999990.00')
        );
    END LOOP;

    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
    DBMS_OUTPUT.PUT_LINE('Subtotal    : ' || TO_CHAR(v_bill.subtotal, '9999990.00'));
    DBMS_OUTPUT.PUT_LINE('Discount    : ' || TO_CHAR(v_bill.discount_amount, '9999990.00'));
    DBMS_OUTPUT.PUT_LINE('Tax         : ' || TO_CHAR(v_bill.tax_amount, '9999990.00'));
    DBMS_OUTPUT.PUT_LINE('Total       : ' || TO_CHAR(v_bill.total_amount, '9999990.00'));
    DBMS_OUTPUT.PUT_LINE('Paid        : ' || TO_CHAR(v_bill.amount_paid, '9999990.00'));
    DBMS_OUTPUT.PUT_LINE('Status      : ' || v_bill.payment_status);
    DBMS_OUTPUT.PUT_LINE('----------------------------------------');
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20027, 'Bill not found for id ' || p_bill_id);
END;
/

PROMPT Creating useful views...

CREATE OR REPLACE VIEW vw_patient_bill_summary AS
SELECT
    p.patient_id,
    p.full_name,
    TRUNC(MONTHS_BETWEEN(SYSDATE, p.date_of_birth) / 12) AS age,
    COUNT(b.bill_id) AS bill_count,
    NVL(SUM(b.total_amount), 0) AS total_billed,
    NVL(SUM(b.amount_paid), 0) AS total_paid,
    NVL(SUM(b.total_amount - b.amount_paid), 0) AS outstanding_balance
FROM patients p
LEFT JOIN bills b
    ON b.patient_id = p.patient_id
GROUP BY p.patient_id, p.full_name, p.date_of_birth;

CREATE OR REPLACE VIEW vw_doctor_schedule AS
SELECT
    a.appointment_id,
    d.full_name AS doctor_name,
    p.full_name AS patient_name,
    a.appointment_at,
    a.status,
    a.reason
FROM appointments a
JOIN doctors d
    ON d.doctor_id = a.doctor_id
JOIN patients p
    ON p.patient_id = a.patient_id;

PROMPT Inserting master data...

INSERT INTO departments (department_id, department_name) VALUES (1, 'Cardiology');
INSERT INTO departments (department_id, department_name) VALUES (2, 'Orthopedics');
INSERT INTO departments (department_id, department_name) VALUES (3, 'General Medicine');

INSERT INTO doctors (
    doctor_id,
    department_id,
    full_name,
    specialization,
    phone,
    email,
    consultation_fee
) VALUES (
    101,
    1,
    'Dr. Meera Sharma',
    'Cardiologist',
    '9876543210',
    'meera.sharma@cityhospital.example',
    800
);

INSERT INTO doctors (
    doctor_id,
    department_id,
    full_name,
    specialization,
    phone,
    email,
    consultation_fee
) VALUES (
    102,
    2,
    'Dr. Arjun Nair',
    'Orthopedic Surgeon',
    '9876501234',
    'arjun.nair@cityhospital.example',
    700
);

INSERT INTO doctors (
    doctor_id,
    department_id,
    full_name,
    specialization,
    phone,
    email,
    consultation_fee
) VALUES (
    103,
    3,
    'Dr. Riya Sen',
    'General Physician',
    '9876505678',
    'riya.sen@cityhospital.example',
    500
);

INSERT INTO treatment_catalog (treatment_code, description, standard_cost) VALUES ('CONSULT', 'Doctor Consultation', 500);
INSERT INTO treatment_catalog (treatment_code, description, standard_cost) VALUES ('ECG', 'Electrocardiogram', 1200);
INSERT INTO treatment_catalog (treatment_code, description, standard_cost) VALUES ('XRAY', 'X-Ray Scan', 900);
INSERT INTO treatment_catalog (treatment_code, description, standard_cost) VALUES ('BLOOD', 'Blood Test Panel', 650);
INSERT INTO treatment_catalog (treatment_code, description, standard_cost) VALUES ('PHYSIO', 'Physiotherapy Session', 1100);

COMMIT;

PROMPT Running sample workflow...

DECLARE
    v_patient_id     patients.patient_id%TYPE;
    v_appointment_id appointments.appointment_id%TYPE;
    v_treatment_id   treatment_records.treatment_id%TYPE;
    v_bill_id        bills.bill_id%TYPE;
BEGIN
    pr_add_patient(
        p_full_name => 'Rahul Verma',
        p_date_of_birth => DATE '1992-04-10',
        p_gender => 'MALE',
        p_phone => '9999900000',
        p_patient_id => v_patient_id,
        p_blood_group => 'B+',
        p_address => '12 Park Street',
        p_emergency_contact => 'Anita Verma - 9999911111'
    );

    pr_schedule_appointment(
        p_patient_id => v_patient_id,
        p_doctor_id => 103,
        p_appointment_at => SYSDATE + 1,
        p_reason => 'Fever and weakness',
        p_appointment_id => v_appointment_id
    );

    pr_record_treatment(
        p_patient_id => v_patient_id,
        p_doctor_id => 103,
        p_treatment_code => 'BLOOD',
        p_diagnosis => 'Viral fever suspected',
        p_prescription => 'Rest, fluids, and paracetamol as prescribed',
        p_treatment_id => v_treatment_id,
        p_bill_id => v_bill_id,
        p_appointment_id => v_appointment_id,
        p_quantity => 1,
        p_discount_percent => 10,
        p_tax_percent => 5
    );

    DBMS_OUTPUT.PUT_LINE('Created patient ID: ' || v_patient_id);
    DBMS_OUTPUT.PUT_LINE('Created appointment ID: ' || v_appointment_id);
    DBMS_OUTPUT.PUT_LINE('Created treatment ID: ' || v_treatment_id);
    DBMS_OUTPUT.PUT_LINE('Auto-generated bill ID: ' || v_bill_id);

    pr_print_bill(v_bill_id);

    pr_pay_bill(
        p_bill_id => v_bill_id,
        p_amount => fn_bill_total(v_bill_id),
        p_payment_mode => 'UPI',
        p_reference_no => 'DEMO-UPI-001'
    );

    DBMS_OUTPUT.PUT_LINE('Balance after payment: ' || fn_patient_balance(v_patient_id));
END;
/

COMMIT;

PROMPT Hospital Patient Management System setup complete.
