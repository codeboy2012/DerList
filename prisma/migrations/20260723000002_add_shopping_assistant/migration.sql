-- CreateTable
CREATE TABLE "shopping_conversations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "shopping_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_messages" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "data" JSONB,

    CONSTRAINT "shopping_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopping_conversations_userId_idx" ON "shopping_conversations"("userId");

-- CreateIndex
CREATE INDEX "shopping_conversations_updatedAt_idx" ON "shopping_conversations"("updatedAt");

-- CreateIndex
CREATE INDEX "shopping_messages_conversationId_idx" ON "shopping_messages"("conversationId");

-- CreateIndex
CREATE INDEX "shopping_messages_createdAt_idx" ON "shopping_messages"("createdAt");

-- AddForeignKey
ALTER TABLE "shopping_conversations" ADD CONSTRAINT "shopping_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_messages" ADD CONSTRAINT "shopping_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "shopping_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;