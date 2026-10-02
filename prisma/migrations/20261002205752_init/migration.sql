-- CreateEnum
CREATE TYPE "SignatoryStatus" AS ENUM ('IMPORTED', 'SENT', 'OPENED', 'VERIFIED', 'UPLOADED', 'SIGNED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('ACCESS', 'SIGN');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examName" TEXT,
    "examDate" TEXT,
    "shift" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signatory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "centreCode" TEXT NOT NULL,
    "centreName" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "SignatoryStatus" NOT NULL DEFAULT 'IMPORTED',
    "linkSentAt" TIMESTAMP(3),
    "linkSentVia" TEXT,
    "openedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "draftKey" TEXT,
    "draftPages" INTEGER,
    "draftSize" INTEGER,
    "draftHash" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "photoKey" TEXT,
    "photoAt" TIMESTAMP(3),
    "faceCheck" TEXT,
    "geoLat" DOUBLE PRECISION,
    "geoLng" DOUBLE PRECISION,
    "geoAccuracy" DOUBLE PRECISION,
    "consentAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedKey" TEXT,
    "signedHash" TEXT,
    "documentId" TEXT,
    "otpRef" TEXT,
    "otpSentAt" TIMESTAMP(3),
    "otpVerifiedAt" TIMESTAMP(3),
    "signIp" TEXT,
    "signUserAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signatory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Otp" (
    "id" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "signatoryId" TEXT,
    "codeHash" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "signatoryId" TEXT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Signatory_token_key" ON "Signatory"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Signatory_documentId_key" ON "Signatory"("documentId");

-- CreateIndex
CREATE INDEX "Signatory_mobile_idx" ON "Signatory"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Signatory_projectId_mobile_key" ON "Signatory"("projectId", "mobile");

-- CreateIndex
CREATE UNIQUE INDEX "Signatory_projectId_centreCode_key" ON "Signatory"("projectId", "centreCode");

-- CreateIndex
CREATE INDEX "Otp_mobile_purpose_idx" ON "Otp"("mobile", "purpose");

-- CreateIndex
CREATE INDEX "AuditLog_projectId_createdAt_idx" ON "AuditLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_signatoryId_createdAt_idx" ON "AuditLog"("signatoryId", "createdAt");

-- AddForeignKey
ALTER TABLE "Signatory" ADD CONSTRAINT "Signatory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_signatoryId_fkey" FOREIGN KEY ("signatoryId") REFERENCES "Signatory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
