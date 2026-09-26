// A floating selection's preview, one output cell of a pyramid level: the
// selected pixels taken through a projective map (as warp.frag's lifting
// mode) landed over what the selection leaves behind in the cell. Unlike
// warp.frag the two come from separate images, so neither window has to hold
// both the cell and the far place its pixels come from: images 1 and 2 are
// the layer and its selection (coverage in red) gathered where the map reads,
// `size` texels; images 3 and 4 are the layer and the selection over the cell
// itself, texel for texel. An output texel (x, y) of the cell, at `origin`
// in the map's coordinates, reads ((a x + b y + c) / w, (d x + e y + f) / w)
// with w = g x + h y + i. `sampling` picks nearest (0), bilinear (1) or bicubic
// (2); all straight alpha in and out, mixed premultiplied.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    float a, b, c, d, e, f;
    vec2 origin;
    vec2 size;
    float g, h, i;
    float sampling;
} params;
layout(set = 0, binding = 1) uniform sampler2D source;
layout(set = 0, binding = 2) uniform sampler2D selection;
layout(set = 0, binding = 3) uniform sampler2D base;
layout(set = 0, binding = 4) uniform sampler2D base_selection;

// A premultiplied source texel weighted by the selection; nothing past the window.
vec4 tap(ivec2 p) {
    if (p.x < 0 || p.y < 0 || p.x >= int(params.size.x) || p.y >= int(params.size.y)) return vec4(0.0);
    vec4 s = texelFetch(source, p, 0);
    return vec4(s.rgb * s.a, s.a) * texelFetch(selection, p, 0).r;
}

// Catmull-Rom weights for the four taps around a sample `t` past the second.
vec4 cubic(float t) {
    float t2 = t * t;
    float t3 = t2 * t;
    return vec4(-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1.0, -1.5 * t3 + 2.0 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2);
}

// The lifted source at `s` (texel centres at whole numbers) by the chosen filter.
vec4 sampled(vec2 s) {
    if (params.sampling < 0.5) return tap(ivec2(floor(s + 0.5)));
    vec2 i = floor(s);
    vec2 f = s - i;
    ivec2 p = ivec2(i);
    if (params.sampling < 1.5)
        return mix(mix(tap(p), tap(p + ivec2(1, 0)), f.x), mix(tap(p + ivec2(0, 1)), tap(p + ivec2(1, 1)), f.x), f.y);
    vec4 wx = cubic(f.x);
    vec4 wy = cubic(f.y);
    vec4 sum = vec4(0.0);
    for (int y = 0; y < 4; y++) {
        vec4 row = vec4(0.0);
        for (int x = 0; x < 4; x++) row += wx[x] * tap(p + ivec2(x - 1, y - 1));
        sum += wy[y] * row;
    }
    sum.a = clamp(sum.a, 0.0, 1.0);
    sum.rgb = clamp(sum.rgb, vec3(0.0), vec3(sum.a * 65504.0));
    return sum;
}

void main() {
    vec2 o = params.origin + gl_FragCoord.xy;
    float w = params.g * o.x + params.h * o.y + params.i;
    vec4 moved = vec4(0.0);
    if (w > 1e-6) {
        moved = sampled(vec2(params.a * o.x + params.b * o.y + params.c, params.d * o.x + params.e * o.y + params.f) / w - 0.5);
    }
    // What the selection leaves behind here, under the moved pixels.
    ivec2 here = ivec2(gl_FragCoord.xy);
    vec4 s = texelFetch(base, here, 0);
    float kept = s.a * (1.0 - texelFetch(base_selection, here, 0).r);
    moved = moved + vec4(s.rgb * kept, kept) * (1.0 - moved.a);
    fragment_color = moved.a > 0.0 ? vec4(moved.rgb / moved.a, moved.a) : vec4(0.0);
}
