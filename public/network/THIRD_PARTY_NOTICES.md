# WT4 network map third-party data and icons

This directory contains only redistributable assets used by the network globe's same-origin fallback scene.

- `basemap/natural-earth-*.geojson`: Natural Earth Vector 5.1.2, 1:110m land and populated places. Natural Earth data is public domain. Source: https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2/geojson
- `icons/weather/*.svg`: Meteocons static fill icons 0.1.0 by Bas Milius, MIT License. Source package: `@meteocons/svg-static@0.1.0`. The full license is preserved in `licenses/METEOCONS-LICENSE.txt`.
- `icons/tabler/*.svg`: Tabler Icons 3.46.0 by Paweł Kuna, MIT License. The stroke color is adapted for the dark map scene; geometry is unchanged. Source: https://github.com/tabler/tabler-icons/tree/v3.46.0/icons/outline. The full license is preserved in `licenses/TABLER-ICONS-LICENSE.txt`.
- `assets/starfield.png`: project-specific background generated with OpenAI ImageGen for this WT4 implementation; it contains no third-party logo or text.

The progressive online basemap uses OpenFreeMap vector tiles. OpenFreeMap's published style attribution credits OpenFreeMap, OpenMapTiles, and OpenStreetMap contributors; the scene source carries the same attribution string so a MapLibre attribution control can render it.

The progressive Earth imagery layer uses NASA GIBS Blue Marble (MODIS), served by NASA's public WMTS endpoint. The MapLibre source renders a `NASA GIBS Blue Marble` attribution link. Blue Marble data credit: NASA/Goddard Space Flight Center Scientific Visualization Studio and Reto Stöckli (NASA/GSFC).
