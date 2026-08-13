import { AllocationClient } from "./AllocationClient";
import { validatedSnapshotGatewayResultV1 } from "../../data/runtime/data-gateway.server";

export default async function AllocationPage() {
  const snapshotResult = await validatedSnapshotGatewayResultV1();
  return <AllocationClient snapshotResult={snapshotResult} />;
}
