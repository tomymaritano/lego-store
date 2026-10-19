-- Admin user management: an admin can block an account (it can no longer
-- log in and its sessions end: the app also bumps sessionVersion), with a
-- note on why. Indexes for the users list (newest first, by role).

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "blockedAt" TIMESTAMP(3),
ADD COLUMN     "blockedReason" TEXT;

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");
