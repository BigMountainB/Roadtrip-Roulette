# Tunnel Face Art Specification

The tunnel renderer uses an 800×450 design coordinate system and projects the
entrance geometry every frame. These images are normalized facade plates, not
fixed-size screenshots. Scale each plate from the live projected facade/mouth
geometry, keep it centered on the projected tunnel centerline, and bottom-anchor
it to the projected tunnel ground line.

All final files are 1600×900 RGBA PNGs with transparent exterior areas and
transparent road openings. Use `setOrigin(0.5, 1)` or the equivalent bottom-
center anchor. Do not fill the transparent openings with black; the existing
tunnel shell, road, vehicles, and lighting must remain visible through them.

| Structure | File | Opening geometry in the 1600×900 master |
|---|---|---|
| Mt. Baker Tunnel | `assets/scenery/tunnels/tunnel_mt_baker_face.png` | One opening, approximately x=429–1171, open to bottom |
| Mercer Island Lid Tunnel | `assets/scenery/tunnels/tunnel_mercer_lid_face.png` | One opening, approximately x=320–1276, open to bottom |
| Snoqualmie wildlife crossing | `assets/scenery/tunnels/tunnel_wildlife_crossing_face.png` | Twin openings approximately x=384–746 and x=853–1215, with solid center pier |

## Runtime fit

- Mt. Baker: fit the single transparent opening to the normal tunnel mouth
  rectangle published by `_drawTunnelFacade()`.
- Mercer lid: use the same projected mouth rectangle, but retain the artwork's
  lower, wider visual profile.
- Wildlife crossing: fit the combined twin-opening span to the wildlife mouth
  bounds and align the opaque center pier to the road median. The existing two
  arch masks remain authoritative for tunnel-interior clipping.
- Preserve aspect ratio. If exact alignment needs adjustment, crop transparent
  outer padding rather than stretching the concrete or arches.
- Keep the current procedural facade as a fallback until every approach and
  viewport has been validated.

Source chroma-key masters are stored in `assets/scenery/tunnels/source/`.
