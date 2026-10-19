-- CreateTable
CREATE TABLE "ListMerge" (
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListMerge_pkey" PRIMARY KEY ("userId","token")
);

-- AddForeignKey
ALTER TABLE "ListMerge" ADD CONSTRAINT "ListMerge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
