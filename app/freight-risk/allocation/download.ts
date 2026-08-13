import type { CvarSimulationResult } from "./engine";
import type { AllocationRunInput } from "./representative";
import {
  serializeRecommendedCvarCsv,
  type CvarCsvArtifact,
} from "./csv";

export interface CsvDownloadPort {
  readonly createObjectUrl: (content: string) => string;
  readonly click: (url: string, filename: string) => void;
  readonly defer: (release: () => void) => void;
  readonly revokeObjectUrl: (url: string) => void;
}

const BROWSER_CSV_DOWNLOAD_PORT: CsvDownloadPort = {
  createObjectUrl(content) {
    return URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    );
  },
  click(url, filename) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    anchor.remove();
  },
  defer(release) {
    window.setTimeout(release, 0);
  },
  revokeObjectUrl(url) {
    URL.revokeObjectURL(url);
  },
};

export function downloadRecommendedCvarCsv(
  runInput: AllocationRunInput,
  result: CvarSimulationResult,
  port: CsvDownloadPort = BROWSER_CSV_DOWNLOAD_PORT,
): CvarCsvArtifact {
  const artifact = serializeRecommendedCvarCsv(
    runInput.representative.route,
    runInput.simulation,
    result,
  );
  const objectUrl = port.createObjectUrl(artifact.content);
  try {
    port.click(objectUrl, artifact.filename);
  } catch (error) {
    port.revokeObjectUrl(objectUrl);
    throw error;
  }
  port.defer(() => port.revokeObjectUrl(objectUrl));
  return artifact;
}
