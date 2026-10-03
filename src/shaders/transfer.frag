// A tile through sRGB's transfer function, texel for texel: `decode` 0 takes
// linear light to sRGB-encoded values, 1 back. Straight alpha in and out,
// drawn with `replace`: work that resamples through the GPU's own filtering
// (Image Size) runs on encoded tiles between the two when the document
// blends in sRGB.
#version 450
#extension GL_GOOGLE_include_directive : require
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params { float decode; } params;
layout(set = 0, binding = 1) uniform sampler2D tile;
#include "srgb.glsl"
void main() {
    vec4 t = texelFetch(tile, ivec2(gl_FragCoord.xy), 0);
    fragment_color = vec4(params.decode > 0.5 ? srgb_decode(t.rgb) : srgb_encode(t.rgb), t.a);
}
