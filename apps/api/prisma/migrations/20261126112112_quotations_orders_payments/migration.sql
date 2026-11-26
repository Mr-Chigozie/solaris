-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'QUOTATION', 'ORDER', 'SYSTEM');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "refId" UUID;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "payoutAccountLast4" TEXT,
ADD COLUMN     "payoutAccountName" TEXT,
ADD COLUMN     "payoutBankCode" TEXT,
ADD COLUMN     "payoutBankName" TEXT,
ADD COLUMN     "payoutsEnabledAt" TIMESTAMP(3),
ADD COLUMN     "paystackSubaccountCode" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "authorizationUrl" TEXT,
ADD COLUMN     "channel" TEXT,
ADD COLUMN     "platformFee" DECIMAL(14,2),
ADD COLUMN     "subaccountCode" TEXT;

-- AlterTable
ALTER TABLE "quotation_revisions" ADD COLUMN     "validUntil" TIMESTAMP(3),
ADD COLUMN     "vatRate" DECIMAL(5,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "title" TEXT,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);
