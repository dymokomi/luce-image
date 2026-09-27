// The layer tile after a stroke: the original tile (image 1, straight alpha)
// with the stroke's paint (image 2, premultiplied: dabs' color and coverage)
// applied as paint or as erasure, the coverage capped by the stroke opacity
// (a brush's texture is in the coverage already: dab.frag textures each
// dab). A retouching stroke paints an effect image (image 4, straight alpha) instead
// of a color: laid over the original through the coverage (clone stamp), or
// mixed with it, replacing it by coverage (blur tool, healing).
// Drawn with `replace`, so what is emitted is stored as is: straight alpha.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    vec4 color;       // straight alpha paint color, linear light
    float opacity;    // stroke opacity, caps the coverage
    float erase;      // 1 erases instead of painting
    float fill;       // 1 ignores the coverage and paints the whole selection
    float selected;   // 1 multiplies by the selection's coverage (image 3, red)
    vec2 tile;        // the tile's top-left in document pixels
    float unused0;
    float unused4;
    float unused5;
    float effect;         // 0 the color, 1 the effect image over, 2 the effect image mixed
    float unused1;
    float unused2;
} params;
layout(set = 0, binding = 1) uniform sampler2D original;
layout(set = 0, binding = 2) uniform sampler2D coverage;
layout(set = 0, binding = 3) uniform sampler2D selection;
layout(set = 0, binding = 4) uniform sampler2D effect;
void main() {
    vec2 uv = gl_FragCoord.xy / 256.0;
    vec4 o = texture(original, uv);
    vec4 paint = texture(coverage, uv);
    float s = (params.fill > 0.5 ? 1.0 : min(paint.a, 1.0)) * params.opacity;
    if (params.selected > 0.5) s *= texture(selection, uv).r;
    if (params.effect > 0.5) {
        vec4 e = texture(effect, uv);
        if (params.effect < 1.5) {
            // Over: a transparent source leaves the original, as a stamp does.
            float ea = e.a * s;
            float a = ea + o.a * (1.0 - ea);
            fragment_color = vec4(a > 0.0 ? (e.rgb * ea + o.rgb * o.a * (1.0 - ea)) / a : o.rgb, a);
        } else {
            // Mixed, premultiplied: the healed pixels replace the original by coverage.
            vec4 m = mix(vec4(o.rgb * o.a, o.a), vec4(e.rgb * e.a, e.a), s);
            fragment_color = m.a > 0.0 ? vec4(m.rgb / m.a, m.a) : vec4(0.0);
        }
        return;
    }
    if (params.erase > 0.5) {
        fragment_color = vec4(o.rgb, o.a * (1.0 - s));
        return;
    }
    vec3 tint = (params.fill > 0.5 || paint.a <= 0.0) ? params.color.rgb : paint.rgb / paint.a;
    float a = s + o.a * (1.0 - s);
    vec3 rgb = a > 0.0 ? (tint * s + o.rgb * o.a * (1.0 - s)) / a : o.rgb;
    fragment_color = vec4(rgb, a);
}
