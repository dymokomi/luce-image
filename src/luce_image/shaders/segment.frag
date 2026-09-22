// One stroke segment's coverage over a 256-pixel tile: the distance from the
// fragment to the segment through a round tip with a hard core and a linear
// falloff, scaled by flow. Composited `over` into the coverage tile, repeated
// segments union smoothly and never crease where a stroke crosses itself.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    vec2 origin;      // the tile's top-left in target pixels (0, 0 for a tile target)
    vec2 a;           // segment start, tile pixels
    vec2 b;           // segment end, tile pixels
    float radius;
    float hardness;   // 0..1: the fraction of the radius at full coverage
    float flow;       // 0..1
} params;
void main() {
    vec2 p = gl_FragCoord.xy - params.origin;
    vec2 ab = params.b - params.a;
    float t = dot(p - params.a, ab) / max(dot(ab, ab), 1e-6);
    vec2 q = params.a + clamp(t, 0.0, 1.0) * ab;
    float d = distance(p, q);
    float core = params.radius * params.hardness;
    float c = 1.0 - smoothstep(core, max(params.radius, core + 0.5), d);
    float a = c * params.flow * vertex_color.a;
    fragment_color = vec4(a, a, a, a);
}
