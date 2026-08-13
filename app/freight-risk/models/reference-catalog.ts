import approvedSnapshot from "./reference-data/models-snapshot-v3.json";
import { modelsCatalogFromDecodedSnapshot, type ModelsSnapshotCatalogV1 } from "./snapshot-adapter";

let validatedCatalog: ModelsSnapshotCatalogV1 | undefined;

export function loadApprovedModelsCatalog(): ModelsSnapshotCatalogV1 {
  validatedCatalog ??= modelsCatalogFromDecodedSnapshot(approvedSnapshot);
  return validatedCatalog;
}
