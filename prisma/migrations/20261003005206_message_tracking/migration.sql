-- AlterTable
ALTER TABLE "Signatory" ADD COLUMN     "msgChannel" TEXT,
ADD COLUMN     "msgError" TEXT,
ADD COLUMN     "msgStatus" TEXT,
ADD COLUMN     "msgStatusAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "signatoryId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "providerId" TEXT,
    "waId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Message_providerId_key" ON "Message"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_waId_key" ON "Message"("waId");

-- CreateIndex
CREATE INDEX "Message_projectId_status_idx" ON "Message"("projectId", "status");

-- CreateIndex
CREATE INDEX "Message_signatoryId_createdAt_idx" ON "Message"("signatoryId", "createdAt");

-- CreateIndex
CREATE INDEX "Signatory_projectId_msgStatus_idx" ON "Signatory"("projectId", "msgStatus");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_signatoryId_fkey" FOREIGN KEY ("signatoryId") REFERENCES "Signatory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
