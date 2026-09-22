// Marching ants: the edge of the selection (image 1, coverage in red) drawn
// at screen resolution. A fragment is on the edge when the coverage at its
// document pixel differs from a neighbour's across the 0.5 line; the dash
// alternates along screen x + y with `phase`.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    vec2 origin;      // where the tile's top-left lands on screen, in target pixels
    float zoom;       // screen pixels per document pixel
    float phase;
    vec2 covered;     // the tile's covered texels
} params;
layout(set = 0, binding = 1) uniform sampler2D selection;
float inside(vec2 texel) {
    if (texel.x < 0.0 || texel.y < 0.0 || texel.x >= params.covered.x || texel.y >= params.covered.y) return 0.0;
    return texture(selection, (floor(texel) + 0.5) / 256.0).r >= 0.5 ? 1.0 : 0.0;
}
void main() {
    vec2 p = (gl_FragCoord.xy - params.origin) / params.zoom;
    float here = inside(p);
    float step = max(1.0, 1.0 / params.zoom);
    float edge = 0.0;
    if (inside(p + vec2(step, 0.0)) != here) edge = 1.0;
    if (inside(p - vec2(step, 0.0)) != here) edge = 1.0;
    if (inside(p + vec2(0.0, step)) != here) edge = 1.0;
    if (inside(p - vec2(0.0, step)) != here) edge = 1.0;
    if (edge < 0.5) { fragment_color = vec4(0.0); return; }
    float dash = mod(gl_FragCoord.x + gl_FragCoord.y + params.phase, 8.0) < 4.0 ? 1.0 : 0.0;
    fragment_color = vec4(vec3(dash), 1.0);
}
