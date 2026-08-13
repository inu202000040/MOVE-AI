import ModelsClient from "./ModelsClient";
import { ModelsDataState } from "./ModelsDataState";
import { loadApprovedModelsCatalog } from "./reference-catalog";

export default function ModelsPage() {
  try {
    return <ModelsClient catalog={loadApprovedModelsCatalog()} />;
  } catch {
    return <ModelsDataState kind="error" />;
  }
}
