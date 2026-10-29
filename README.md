# ComfyUI AIOFC (`ai_ofc`)

Lightweight, clean ComfyUI custom node package providing realistic digital camera pipeline simulation and sensor noise injection.

## Included Nodes

### 1. 📷 AIOFC Camera Look (`Aiofc_Camera_Look`)
- **Category**: `AIOFC/Post-Processing`
- **Inputs**:
  - `image` (`IMAGE`): Input image tensor.
  - `enabled` (`BOOLEAN`): Bypass or enable processing.
  - `demosaic_pixel_blur` (`FLOAT`): Bayer pixel displacement (subtle diagonal channel shift).
  - `noise_strength` (`FLOAT`): Sensor read & shot noise level.
  - `kernel_motion_blur` (`FLOAT`): Motion blur kernel width.
  - `jpeg_compression` (`INT`): Compression quality (100 = lossless, 85 = artifacting).
- **Outputs**:
  - `image` (`IMAGE`): Processed camera pipeline image.

### 2. 🎞️ AIOFC Renoise (`Aiofc_Renoise`)
- **Category**: `AIOFC/Post-Processing`
- **Inputs**:
  - `image` (`IMAGE`): Input image tensor.
  - `seed` (`INT`): Deterministic noise generation seed.
  - `iso_preset` (`COMBO`): Preset noise profiles (`ISO 0 (Off)`, `ISO 50`, `ISO 100 (Clean)`, `ISO 200`, `ISO 400`, `ISO 800`, `ISO 1600`, `Night Mode`).
  - `grain_size` (`FLOAT`): Grain structure scale.
- **Outputs**:
  - `image` (`IMAGE`): Renoised image with realistic luminance grain and shadow-weighted chroma noise.

## Installation

Clone this repository into your ComfyUI `custom_nodes` directory:

```bash
git clone https://github.com/bentruofc/ai_ofc.git custom_nodes/ai_ofc
pip install -r custom_nodes/ai_ofc/requirements.txt
```

## Requirements
- `Pillow`
- `kornia`
