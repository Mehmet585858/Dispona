-- CreateTable
CREATE TABLE "VoiceToolCall" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "toolCallId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "result" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "VoiceToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceToolCall_tenantId_idx" ON "VoiceToolCall"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "VoiceToolCall_callId_toolCallId_key" ON "VoiceToolCall"("callId", "toolCallId");

-- AddForeignKey
ALTER TABLE "VoiceToolCall" ADD CONSTRAINT "VoiceToolCall_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

