// A matte over the view: the part a mask or selection leaves out covered in
// `color` at `opacity` (Quick Mask's tint, Select and Mask's overlay, on black
// or on white). Image 1 is a tile of the coverage at the view's level, its red
// the coverage kept (1 revealed); where it hides, the matte is `color` at
// `opacity`, premultiplied, laid over the view by Blend.over — which mixes in
// linear light. With `srgb` the matte mixes as sRGB-encoded values instead:
// image 2 is the composite tile under it (the same cell), laid over the
// checkerboard as the view draws it, and where the matte covers anything the
// mixed color is emitted whole.
#version 450
#extension GL_GOOGLE_include_directive : require
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    vec2 origin;      // where the tile's top-left lands on screen, in target pixels
    float zoom;       // screen pixels per texel
    float opacity;
    vec2 covered;     // the tile's covered texels
    float srgb;       // 1: mix the encoded values over image 2
    float cell;       // the checkerboard's squares in target pixels; 0: none
    vec4 color;
    vec2 squares;     // where the checkerboard's first square's top-left lands
    vec2 unused;
    vec4 light;       // the light squares (linear)
    vec4 dark;        // the dark squares (linear)
} params;
layout(set = 0, binding = 1) uniform sampler2D mask;
layout(set = 0, binding = 2) uniform sampler2D composite;
#include "srgb.glsl"
void main() {
    vec2 p = (gl_FragCoord.xy - params.origin) / params.zoom;
    if (p.x < 0.0 || p.y < 0.0 || p.x >= params.covered.x || p.y >= params.covered.y) { fragment_color = vec4(0.0); return; }
    float revealed = texture(mask, p / 256.0).r;
    float alpha = (1.0 - clamp(revealed, 0.0, 1.0)) * params.opacity;
    if (params.srgb < 0.5) {
        fragment_color = vec4(params.color.rgb * alpha, alpha);
        return;
    }
    if (alpha <= 0.0) { fragment_color = vec4(0.0); return; }
    // What the view shows here, premultiplied and encoded, then the matte over it.
    vec4 c = texture(composite, (clamp(p, vec2(0.5), params.covered - 0.5)) / 256.0);
    float a = clamp(c.a, 0.0, 1.0);
    vec4 under = vec4(srgb_encode(clamp(c.rgb, 0.0, 1.0)) * a, a);
    if (params.cell > 0.0) {
        vec2 square = floor((gl_FragCoord.xy - params.squares) / params.cell);
        vec3 board = mod(square.x + square.y, 2.0) >= 1.0 ? params.dark.rgb : params.light.rgb;
        under = vec4(under.rgb + srgb_encode(board) * (1.0 - a), 1.0);
    }
    vec4 result = vec4(srgb_encode(params.color.rgb) * alpha + under.rgb * (1.0 - alpha), alpha + under.a * (1.0 - alpha));
    fragment_color = vec4(srgb_decode(result.rgb / result.a) * result.a, result.a);
}
