import { AllocationClient } from "./AllocationClient";
import { UNAVAILABLE_ALLOCATION_REPRESENTATIVE_SOURCE } from "./source";

export default function AllocationPage() {
  return <AllocationClient source={UNAVAILABLE_ALLOCATION_REPRESENTATIVE_SOURCE} />;
}
