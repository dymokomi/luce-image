// The layer tile after a stroke: the original tile (image 1, straight alpha)
// with the stroke's coverage (image 2, red) applied as paint or as erasure.
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
} params;
layout(set = 0, binding = 1) uniform sampler2D original;
layout(set = 0, binding = 2) uniform sampler2D coverage;
layout(set = 0, binding = 3) uniform sampler2D selection;
void main() {
    vec2 uv = gl_FragCoord.xy / 256.0;
    vec4 o = texture(original, uv);
    float s = (params.fill > 0.5 ? 1.0 : min(texture(coverage, uv).r, 1.0)) * params.opacity;
    if (params.selected > 0.5) s *= texture(selection, uv).r;
    if (params.erase > 0.5) {
        fragment_color = vec4(o.rgb, o.a * (1.0 - s));
        return;
    }
    float a = s + o.a * (1.0 - s);
    vec3 rgb = a > 0.0 ? (params.color.rgb * s + o.rgb * o.a * (1.0 - s)) / a : o.rgb;
    fragment_color = vec4(rgb, a);
}
