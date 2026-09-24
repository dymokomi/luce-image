// Selected pixels moved within a layer: each texel of the output tile is what
// stays under it (the layer less what the selection lifts, or all of it when
// copying) with, over it, the lifted pixels that land there from `offset`
// away. Image 1 is the whole layer and image 2 the whole selection (coverage
// in red), both flattened, both straight alpha. Drawn with `replace`, so the
// straight-alpha result is stored as is.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    vec2 tile;      // the output tile's top-left in document pixels
    vec2 offset;    // the move in whole document pixels
    vec2 extent;    // the document's width and height
    float copy;     // 1 leaves the pixels where they were too
    float unused;
} params;
layout(set = 0, binding = 1) uniform sampler2D layer;
layout(set = 0, binding = 2) uniform sampler2D selection;
bool inside(vec2 p) { return p.x >= 0.0 && p.y >= 0.0 && p.x < params.extent.x && p.y < params.extent.y; }
void main() {
    vec2 p = floor(gl_FragCoord.xy) + params.tile;
    vec4 base = vec4(0.0);
    if (inside(p)) {
        base = texelFetch(layer, ivec2(p), 0);
        if (params.copy < 0.5) base.a *= 1.0 - texelFetch(selection, ivec2(p), 0).r;
    }
    vec2 q = p - params.offset;
    vec4 moved = vec4(0.0);
    if (inside(q)) {
        moved = texelFetch(layer, ivec2(q), 0);
        moved.a *= texelFetch(selection, ivec2(q), 0).r;
    }
    float a = moved.a + base.a * (1.0 - moved.a);
    vec3 rgb = a > 0.0 ? (moved.rgb * moved.a + base.rgb * base.a * (1.0 - moved.a)) / a : vec3(0.0);
    fragment_color = vec4(rgb, a);
}
