export const FORECAST_HORIZONS = [1, 2, 3, 4] as const;

export type ForecastHorizon = (typeof FORECAST_HORIZONS)[number];

export function decodeForecastHorizon(value: unknown): ForecastHorizon | null {
  switch (value) {
    case 1:
    case 2:
    case 3:
    case 4:
      return value;
    default:
      return null;
  }
}

export function selectForecastHorizon(
  current: ForecastHorizon,
  requested: unknown,
): ForecastHorizon {
  return decodeForecastHorizon(requested) ?? current;
}

export function hasExactHorizonOrder(
  items: readonly { readonly horizonWeeks: ForecastHorizon }[],
): boolean {
  return items.length === FORECAST_HORIZONS.length
    && items.every((item, index) => item.horizonWeeks === FORECAST_HORIZONS[index]);
}
