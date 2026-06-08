"""
AIOFC Float Input Node
A simple float input node with three decimal place precision.
"""


class AIOFC_FloatInput:
    """
    A simple float input node that accepts values with up to three decimal places.
    Useful for precise parameter control in workflows.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "value": ("FLOAT", {
                    "default": 0.000,
                    "min": -999999.999,
                    "max": 999999.999,
                    "step": 0.001,
                    "tooltip": "Float value with up to 3 decimal places precision",
                    "display": "number",
                }),
            },
        }

    RETURN_TYPES = ("FLOAT",)
    RETURN_NAMES = ("float",)
    FUNCTION = "output_float"
    CATEGORY = "AIOFC/Input"
    DESCRIPTION = "Outputs a float value with up to three decimal places precision"

    def output_float(self, value):
        """
        Returns the input float value.

        Args:
            value (float): The float value to output

        Returns:
            tuple: A tuple containing the float value
        """
        return (value,)


NODE_CLASS_MAPPINGS = {
    "AIOFC_FloatInput": AIOFC_FloatInput,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AIOFC_FloatInput": "🔢 AIOFC Float Input (3 decimals)",
}
