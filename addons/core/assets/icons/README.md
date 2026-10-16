# LumaUI icons

Original monochrome SVG symbols for editor elements and common interface actions. The set uses a 24-unit square view box, 1.8-unit rounded strokes and white alpha masks. LumaUI's MIT license applies.

Edit the SVG sources in `svg/`. The normal build uses resvg to render transparent, uncompressed 32-bit TGA textures at 32 × 32, copies them to the core addon's `media/icons/` directory, and generates the `Theme.icons` path catalog. WoW receives native textures; SVG rendering runs only during development.

Use `npm run icons:preview` to inspect a contact sheet in `artifacts/editor-icons.png`. Generated textures are cached in `.generated/icons/`; they are rebuilt from the SVG sources.
