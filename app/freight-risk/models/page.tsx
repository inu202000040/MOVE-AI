import ModelsClient from "./ModelsClient";
import { ModelsDataState } from "./ModelsDataState";
import { validatedSnapshotGatewayResultV1 } from "../../data/runtime/data-gateway.server";
import { modelsCatalogFromDecodedSnapshot } from "./snapshot-adapter";

export default async function ModelsPage() {
  try {
    const result = await validatedSnapshotGatewayResultV1();
    if (result.state !== "READY" || result.data === null) {
      return <ModelsDataState kind="error" />;
    }
    return <ModelsClient catalog={modelsCatalogFromDecodedSnapshot(result.data)} />;
  } catch {
    return <ModelsDataState kind="error" />;
  }
}
