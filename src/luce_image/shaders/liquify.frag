// Liquify's push, one output cell of a pyramid level: each output texel shows
// the layer where the displacement field sends it. Image 1 is a window of the
// layer (straight alpha, linear light) at some level; image 2 the field over
// the cell, n by n samples `spacing` document pixels apart from the cell's
// first pixel, each the displacement in document pixels split in two halves
// (xy coarse, zw fine; their sum is the displacement). Positions are pixel
// indices: pixel i of the document sits at i, as the CPU grid has them.
//   place: the cell's first document pixel (x, y), document pixels a texel
//   window: the window's first texel (x, y) at its level, its size
//   field: document pixels a window texel, between field samples, samples a side
// Past the window nothing shows; samples mix premultiplied.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params { vec4 place; vec4 window; vec4 field; } params;
layout(set = 0, binding = 1) uniform sampler2D layer;
layout(set = 0, binding = 2) uniform sampler2D field;

// One window texel, premultiplied; clear past the window.
vec4 texel(ivec2 p) {
    if (p.x < 0 || p.y < 0 || p.x >= int(params.window.z) || p.y >= int(params.window.w)) return vec4(0.0);
    vec4 t = texelFetch(layer, p, 0);
    return vec4(t.rgb * t.a, t.a);
}

// A bilinear sample of the window at `at`, texel centres at i + 0.5.
vec4 tap(vec2 at) {
    vec2 q = at - 0.5;
    vec2 f = q - floor(q);
    ivec2 b = ivec2(floor(q));
    return mix(mix(texel(b), texel(b + ivec2(1, 0)), f.x), mix(texel(b + ivec2(0, 1)), texel(b + ivec2(1, 1)), f.x), f.y);
}

// Field sample (x, y), held to the field.
vec2 shift(ivec2 p) {
    vec4 v = texelFetch(field, clamp(p, ivec2(0), ivec2(int(params.field.z) - 1)), 0);
    return v.xy + v.zw;
}

// The displacement at `u`, in field samples from the cell's first pixel.
vec2 displacement(vec2 u) {
    vec2 f = u - floor(u);
    ivec2 b = ivec2(floor(u));
    return mix(mix(shift(b), shift(b + ivec2(1, 0)), f.x), mix(shift(b + ivec2(0, 1)), shift(b + ivec2(1, 1)), f.x), f.y);
}

void main() {
    // The middle of this texel's pixels, as a pixel index.
    vec2 centre = params.place.xy + gl_FragCoord.xy * params.place.z - 0.5;
    vec2 source = centre + displacement((centre - params.place.xy) / params.field.y);
    vec4 sum = tap((source + 0.5) / params.field.x - params.window.xy);
    fragment_color = sum.a > 1e-6 ? vec4(sum.rgb / sum.a, sum.a) : vec4(0.0);
}
