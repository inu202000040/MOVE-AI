import { AllocationClient } from "./AllocationClient";
import { KNEI_REPRESENTATIVE_SELECTION } from "./fixture";

export default function AllocationPage() {
  return <AllocationClient selection={KNEI_REPRESENTATIVE_SELECTION} />;
}
