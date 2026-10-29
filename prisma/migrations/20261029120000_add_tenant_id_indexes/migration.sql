-- CreateIndex
CREATE INDEX "PushSubscription_tenantId_idx" ON "PushSubscription"("tenantId");

-- CreateIndex
CREATE INDEX "Shift_tenantId_idx" ON "Shift"("tenantId");

-- CreateIndex
CREATE INDEX "VehicleLocation_tenantId_idx" ON "VehicleLocation"("tenantId");

-- CreateIndex
CREATE INDEX "RideStatusEvent_tenantId_idx" ON "RideStatusEvent"("tenantId");

-- CreateIndex
CREATE INDEX "Suggestion_tenantId_idx" ON "Suggestion"("tenantId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_idx" ON "Notification"("tenantId");
