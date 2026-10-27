import { anrufeLaden } from "./actions";
import { AnrufeClient } from "./AnrufeClient";

export default async function AnrufePage() {
  const anrufe = await anrufeLaden();
  return <AnrufeClient anrufe={anrufe} />;
}
