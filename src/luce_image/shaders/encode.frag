// A composited tile as an export's 8-bit sRGB bytes, drawn into a strip with
// `replace` onto an rgba8_linear target, so each output value k/255 is stored
// as the byte k. Image 1 is the tile (straight alpha, linear light, half
// floats), image 2 the table of 4097 sRGB bytes for 0..1 in 4096 steps: the
// same table and rounding the CPU used, so opaque pixels come out byte for byte
// as before. `over` blends onto `matte` (linear) and writes alpha one; without
// it the alpha is kept, rounded to the nearest byte.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    vec2 origin;    // the tile's top-left in the strip
    float over;     // 1 over the matte
    float unused;
    vec4 matte;     // linear RGB
} params;
layout(set = 0, binding = 1) uniform sampler2D tile;
layout(set = 0, binding = 2) uniform sampler2D table;
float encoded(float value) {
    // NaN and negatives land on zero, as on the CPU.
    float v = value > 0.0 ? min(value, 1.0) : 0.0;
    return texelFetch(table, ivec2(int(floor(v * 4096.0 + 0.5)), 0), 0).r;
}
void main() {
    vec4 t = texelFetch(tile, ivec2(floor(gl_FragCoord.xy - params.origin)), 0);
    float a = t.a > 0.0 ? min(t.a, 1.0) : 0.0;
    if (params.over < 0.5 || t.a == 1.0) {
        float alpha = params.over < 0.5 ? floor(a * 255.0 + 0.5) / 255.0 : 1.0;
        fragment_color = vec4(encoded(t.r), encoded(t.g), encoded(t.b), alpha);
        return;
    }
    vec3 blended = t.rgb * a + params.matte.rgb * (1.0 - a);
    fragment_color = vec4(encoded(blended.r), encoded(blended.g), encoded(blended.b), 1.0);
}
