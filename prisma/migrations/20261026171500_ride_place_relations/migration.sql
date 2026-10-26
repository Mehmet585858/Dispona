-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_pickupPlaceId_fkey" FOREIGN KEY ("pickupPlaceId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ride" ADD CONSTRAINT "Ride_dropoffPlaceId_fkey" FOREIGN KEY ("dropoffPlaceId") REFERENCES "Place"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
