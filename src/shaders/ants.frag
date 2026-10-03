// Marching ants: the edge of the selection drawn at screen resolution. Image 1
// is this tile's coverage (red), images 2 and 3 the tiles to its right and
// below (transparent stand-ins when absent, which is correct: a missing tile
// selects nothing). A fragment is on the edge when the coverage at its document
// pixel differs from a neighbour's across the 0.5 line: to the left and above
// within this tile, to the right and below possibly in the next one. The dash
// alternates along screen x + y with `phase`.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    vec2 origin;      // where the tile's top-left lands on screen, in target pixels
    float zoom;       // screen pixels per document pixel
    float phase;
    vec2 covered;     // the tile's covered texels
    vec2 limit;       // the document's remaining extent past this tile's origin
} params;
layout(set = 0, binding = 1) uniform sampler2D selection;
layout(set = 0, binding = 2) uniform sampler2D right_tile;
layout(set = 0, binding = 3) uniform sampler2D below_tile;
float inside(vec2 texel) {
    if (texel.x < 0.0 || texel.y < 0.0 || texel.x >= params.limit.x || texel.y >= params.limit.y) return 0.0;
    vec2 at = floor(texel) + 0.5;
    float value;
    if (texel.x >= 256.0) value = texture(right_tile, (at - vec2(256.0, 0.0)) / 256.0).r;
    else if (texel.y >= 256.0) value = texture(below_tile, (at - vec2(0.0, 256.0)) / 256.0).r;
    else value = texture(selection, at / 256.0).r;
    return value >= 0.5 ? 1.0 : 0.0;
}
void main() {
    vec2 p = (gl_FragCoord.xy - params.origin) / params.zoom;
    if (p.x < 0.0 || p.y < 0.0 || p.x >= params.covered.x || p.y >= params.covered.y) { fragment_color = vec4(0.0); return; }
    float here = inside(p);
    float step = max(1.0, 1.0 / params.zoom);
    float edge = 0.0;
    if (inside(p + vec2(step, 0.0)) != here) edge = 1.0;
    if (inside(p + vec2(0.0, step)) != here) edge = 1.0;
    if (p.x - step >= 0.0 && inside(p - vec2(step, 0.0)) != here) edge = 1.0;
    if (p.y - step >= 0.0 && inside(p - vec2(0.0, step)) != here) edge = 1.0;
    if (edge < 0.5) { fragment_color = vec4(0.0); return; }
    float dash = mod(gl_FragCoord.x + gl_FragCoord.y + params.phase, 8.0) < 4.0 ? 1.0 : 0.0;
    fragment_color = vec4(vec3(dash), 1.0);
}
