// A layer's effects for one output tile, drawn under the layer: images 1..4
// are whole-document textures — the layer itself (for its alpha), its alpha
// blurred for the shadow, dilated for the stroke, and blurred for the glow.
// `ox`/`oy` is the tile's document origin, `w`/`h` the document size.
// Straight alpha out, in linear light.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    float ox, oy, w, h;
    float shadow_on, shadow_dx, shadow_dy, shadow_r, shadow_g, shadow_b, shadow_opacity;
    float stroke_on, stroke_r, stroke_g, stroke_b, stroke_opacity;
    float glow_on, glow_r, glow_g, glow_b, glow_opacity;
} params;
layout(set = 0, binding = 1) uniform sampler2D layer;
layout(set = 0, binding = 2) uniform sampler2D shadow;
layout(set = 0, binding = 3) uniform sampler2D stroke;
layout(set = 0, binding = 4) uniform sampler2D glow;
float alpha_of(sampler2D image, ivec2 p) {
    if (p.x < 0 || p.y < 0 || p.x >= int(params.w) || p.y >= int(params.h)) return 0.0;
    return texelFetch(image, p, 0).a;
}
vec4 over(vec4 under, vec3 color, float a) {
    // Premultiplied "over": the new layer of color goes on top of what is there.
    return vec4(color * a + under.rgb * (1.0 - a), a + under.a * (1.0 - a));
}
void main() {
    ivec2 p = ivec2(gl_FragCoord.xy) + ivec2(int(params.ox), int(params.oy));
    float a = alpha_of(layer, p);
    vec4 result = vec4(0.0);
    if (params.shadow_on > 0.5) {
        float s = alpha_of(shadow, p - ivec2(int(params.shadow_dx), int(params.shadow_dy))) * params.shadow_opacity;
        result = over(result, vec3(params.shadow_r, params.shadow_g, params.shadow_b), s);
    }
    if (params.glow_on > 0.5) {
        float g = min(1.0, alpha_of(glow, p) * 1.5) * params.glow_opacity;
        result = over(result, vec3(params.glow_r, params.glow_g, params.glow_b), g);
    }
    if (params.stroke_on > 0.5) {
        float s = max(alpha_of(stroke, p) - a, 0.0) * params.stroke_opacity;
        result = over(result, vec3(params.stroke_r, params.stroke_g, params.stroke_b), s);
    }
    fragment_color = result.a > 0.0 ? vec4(result.rgb / result.a, result.a) : vec4(0.0);
}
