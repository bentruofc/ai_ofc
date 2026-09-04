from .nano_banana_aio import NanoBananaAIO
from ..api_keys import ApiKeysLoaderNode  # au lieu de ..core.api_keys

NODE_CLASS_MAPPINGS = {
    "NanoBananaAIO":       NanoBananaAIO,
    "Aiorbust_Api_Loader": ApiKeysLoaderNode,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NanoBananaAIO":       "Aiorbust Image and Video Edit AIO",
    "Aiorbust_Api_Loader": "Aiorbust Api Loader",
}