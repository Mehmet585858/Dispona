import { createOpenRouteService } from "./openRouteService";

export const routingProvider = createOpenRouteService(process.env.ORS_API_KEY);
export { GEOCODE_SICHER_SCHWELLE } from "./openRouteService";
export type { GeocodeResult, LatLng, RoutingProvider } from "./types";
