// The layer tile after a stroke: the original tile (image 1, straight alpha)
// with the stroke's paint (image 2, premultiplied: dabs' colour and coverage)
// applied as paint or as erasure, the coverage capped by the stroke opacity
// and, for a textured brush, modulated by a procedural pattern in document
// space, as Photoshop textures a whole stroke rather than each dab.
// Drawn with `replace`, so what is emitted is stored as is: straight alpha.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    vec4 color;       // straight alpha paint colour, linear light
    float opacity;    // stroke opacity, caps the coverage
    float erase;      // 1 erases instead of painting
    float fill;       // 1 ignores the coverage and paints the whole selection
    float selected;   // 1 multiplies by the selection's coverage (image 3, red)
    vec2 tile;        // the tile's top-left in document pixels, for the texture
    float texture_kind;   // 0 none, 1 grain, 2 canvas weave, 3 dots
    float texture_scale;
    float texture_depth;  // 0..1: how much the pattern shows
    float unused0;
    float unused1;
    float unused2;
} params;
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float textured(vec2 document) {
    float scale = max(params.texture_scale, 0.1);
    if (params.texture_kind < 0.5) return 1.0;
    if (params.texture_kind < 1.5) {
        // Grain: a value per 3-pixel cell, blended with its neighbours.
        vec2 cell = document / (3.0 * scale);
        vec2 base = floor(cell);
        vec2 f = fract(cell);
        float a = mix(hash(base), hash(base + vec2(1.0, 0.0)), f.x);
        float b = mix(hash(base + vec2(0.0, 1.0)), hash(base + vec2(1.0, 1.0)), f.x);
        return mix(a, b, f.y);
    }
    if (params.texture_kind < 2.5) {
        // Canvas: two crossed weaves.
        vec2 w = document / (4.0 * scale);
        return clamp(0.5 + 0.25 * sin(w.x * 6.2832) + 0.25 * sin(w.y * 6.2832), 0.0, 1.0);
    }
    // Dots: a round hole in each cell.
    vec2 local = fract(document / (6.0 * scale)) - 0.5;
    return 1.0 - smoothstep(0.25, 0.4, length(local));
}
layout(set = 0, binding = 1) uniform sampler2D original;
layout(set = 0, binding = 2) uniform sampler2D coverage;
layout(set = 0, binding = 3) uniform sampler2D selection;
void main() {
    vec2 uv = gl_FragCoord.xy / 256.0;
    vec4 o = texture(original, uv);
    vec4 paint = texture(coverage, uv);
    float s = (params.fill > 0.5 ? 1.0 : min(paint.a, 1.0)) * params.opacity;
    if (params.fill < 0.5) s *= mix(1.0, textured(gl_FragCoord.xy + params.tile), params.texture_depth);
    if (params.selected > 0.5) s *= texture(selection, uv).r;
    if (params.erase > 0.5) {
        fragment_color = vec4(o.rgb, o.a * (1.0 - s));
        return;
    }
    vec3 tint = (params.fill > 0.5 || paint.a <= 0.0) ? params.color.rgb : paint.rgb / paint.a;
    float a = s + o.a * (1.0 - s);
    vec3 rgb = a > 0.0 ? (tint * s + o.rgb * o.a * (1.0 - s)) / a : o.rgb;
    fragment_color = vec4(rgb, a);
}
