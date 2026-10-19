-- Admin audit log for every admin mutation: the IP the request came from
-- (when a proxy is trusted) and an index for the "by admin" filter of
-- /admin/audit (newest first).

-- DropIndex
DROP INDEX "AuditLog_actorId_idx";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "ip" TEXT;

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
