#!/bin/bash
# Save a Gemini-generated image from an open browser tab
# Usage: ./save-gemini-image.sh <output_path>
# Requires: the image to be open in a separate browser tab (window.open from Gemini)

OUTPUT="$1"
if [ -z "$OUTPUT" ]; then
  echo "Usage: $0 <output_path>"
  exit 1
fi

# Extract base64 from the browser tab via CDP evaluate
# This should be called after the image tab is open
echo "Saving to $OUTPUT..."
