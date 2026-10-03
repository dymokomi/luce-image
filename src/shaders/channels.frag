// The view of a composite tile: its red, green and blue kept or hidden, or
// one channel alone as grayscale, over the view's checkerboard, tinted where
// shown alpha channels and Quick Mask leave pixels out. Image 1 is a
// straight-alpha tile (the composite at the view's level, a coarser one
// standing in, or an alpha channel's selection tile); `region` (corner, size)
// is the texels of it drawn into the destination whose top-left lands at
// `origin`. Images 2..4 are up to three tints' coverage over the same cell
// (red: 1 leaves the pixel clear), `tint_scale` their texels per target pixel.
// Everything mixes as sRGB-encoded values with `srgb` (as Photoshop draws a
// document that blends in sRGB), else in linear light. With the checkerboard
// the result is opaque; the output is premultiplied, for Blend.over.
//   gray 0: each channel times `keep` (1 shown, 0 hidden), in color
//   gray 1: dot(color, keep) as gray: one channel alone, keep picking it
//   gray 2: the same, opaque: an alpha channel (coverage in red) seen alone
//   gray 3: an alpha channel over the picture: `keep`'s color at its w
//           opacity where the channel (coverage in red) selects nothing
#version 450
#extension GL_GOOGLE_include_directive : require
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    vec2 origin;      // where the region's top-left lands on screen, in target pixels
    vec2 scale;       // texels per target pixel, across and down
    vec2 corner;      // the region's first texel in the tile
    vec2 size;        // the region's texels
    vec4 keep;        // red, green, blue shown (1) or hidden (0); a matte's color and opacity
    float gray;       // 0 color, 1 grayscale, 2 opaque grayscale, 3 matte
    float srgb;       // 1: mix the encoded values
    float cell;       // the checkerboard's squares in target pixels; 0: none
    float tints;      // how many of images 2..4 tint, 0..3
    vec2 squares;     // where the checkerboard's first square's top-left lands
    vec2 tint_scale;  // coverage texels per target pixel
    vec4 light;       // the light squares (linear), and the tints' opacity in w
    vec4 dark;        // the dark squares (linear)
    vec4 tint;        // the tints' color (linear)
} params;
layout(set = 0, binding = 1) uniform sampler2D image;
layout(set = 0, binding = 2) uniform sampler2D first_tint;
layout(set = 0, binding = 3) uniform sampler2D second_tint;
layout(set = 0, binding = 4) uniform sampler2D third_tint;
#include "srgb.glsl"
bool encoded() { return params.srgb > 0.5; }
vec3 mixing(vec3 c) { return encoded() ? srgb_encode(c) : c; }

// Premultiplied `color` at `amount` over `under`.
vec4 over(vec4 under, vec3 color, float amount) {
    return vec4(color * amount + under.rgb * (1.0 - amount), amount + under.a * (1.0 - amount));
}

void main() {
    vec2 p = (gl_FragCoord.xy - params.origin) * params.scale;
    if (p.x < 0.0 || p.y < 0.0 || p.x >= params.size.x || p.y >= params.size.y) { fragment_color = vec4(0.0); return; }
    // Held inside the region: a filtered sample at its edge reads nothing past it.
    vec4 c = texture(image, (params.corner + clamp(p, vec2(0.5), params.size - 0.5)) / 256.0);
    if (params.gray > 2.5) {
        float covered = (1.0 - clamp(c.r, 0.0, 1.0)) * params.keep.a;
        fragment_color = vec4(params.keep.rgb * covered, covered);
        return;
    }
    float alpha = params.gray > 1.5 ? 1.0 : clamp(c.a, 0.0, 1.0);
    vec3 shown = params.gray > 0.5 ? vec3(dot(c.rgb, params.keep.rgb)) : c.rgb * params.keep.rgb;
    // Premultiplied, in the mixing space from here on.
    vec4 result = vec4(mixing(clamp(shown, 0.0, 1.0)) * alpha, alpha);
    if (params.cell > 0.0) {
        vec2 square = floor((gl_FragCoord.xy - params.squares) / params.cell);
        vec3 under = mod(square.x + square.y, 2.0) >= 1.0 ? params.dark.rgb : params.light.rgb;
        result = vec4(result.rgb + mixing(under) * (1.0 - alpha), 1.0);
    }
    int tints = int(params.tints + 0.5);
    if (tints > 0) {
        vec2 t = (gl_FragCoord.xy - params.origin) * params.tint_scale / 256.0;
        vec3 color = mixing(params.tint.rgb);
        result = over(result, color, (1.0 - clamp(texture(first_tint, t).r, 0.0, 1.0)) * params.light.w);
        if (tints > 1) result = over(result, color, (1.0 - clamp(texture(second_tint, t).r, 0.0, 1.0)) * params.light.w);
        if (tints > 2) result = over(result, color, (1.0 - clamp(texture(third_tint, t).r, 0.0, 1.0)) * params.light.w);
    }
    if (encoded() && result.a > 0.0) result.rgb = srgb_decode(result.rgb / result.a) * result.a;
    fragment_color = result;
}
