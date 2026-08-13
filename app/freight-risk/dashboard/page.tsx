import DashboardRuntime from "./DashboardRuntime";
import "./dashboard.css";
import { validatedSnapshotGatewayResultV1 } from "../../data/runtime/data-gateway.server";

export default async function DashboardPage() {
  const initialSnapshotResult = await validatedSnapshotGatewayResultV1();
  return <DashboardRuntime initialSnapshotResult={initialSnapshotResult} />;
}
