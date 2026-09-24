// A layer's effects for one output tile, from whole-document textures (images
// 1..4). `ox`/`oy` is the tile's document origin, `w`/`h` the document size.
// Two passes, which share the effect slots `a` and `b`:
// - under (over = 0): what is drawn under the layer — `a` the drop shadow,
//   `b` the outer glow, and the stroke outside the edge. Images: the layer,
//   its alpha blurred for the shadow, dilated for the stroke, blurred for
//   the glow.
// - over (over = 1): the layer itself with its colors changed where its own
//   effects are — `b` the color overlay, `a` the inner shadow, the stroke
//   inside the edge, in that order — its alpha kept. Images: the layer, its
//   alpha blurred for the inner shadow, eroded for the stroke.
// Straight alpha out, in linear light.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    float ox, oy, w, h;
    float over;
    float a_on, a_dx, a_dy, a_r, a_g, a_b, a_opacity;
    float stroke_on, stroke_r, stroke_g, stroke_b, stroke_opacity;
    float b_on, b_r, b_g, b_b, b_opacity;
} params;
layout(set = 0, binding = 1) uniform sampler2D layer;
layout(set = 0, binding = 2) uniform sampler2D first;
layout(set = 0, binding = 3) uniform sampler2D second;
layout(set = 0, binding = 4) uniform sampler2D third;
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
    ivec2 shift = ivec2(int(params.a_dx), int(params.a_dy));
    if (params.over > 0.5) {
        vec4 own = (p.x < 0 || p.y < 0 || p.x >= int(params.w) || p.y >= int(params.h)) ? vec4(0.0) : texelFetch(layer, p, 0);
        vec3 rgb = own.rgb;
        if (params.b_on > 0.5) rgb = mix(rgb, vec3(params.b_r, params.b_g, params.b_b), params.b_opacity);
        if (params.a_on > 0.5) {
            // Shadowed where the layer's own shape, moved and blurred, does not reach.
            float shade = 1.0 - alpha_of(first, p - shift);
            rgb = mix(rgb, vec3(params.a_r, params.a_g, params.a_b), shade * params.a_opacity);
        }
        if (params.stroke_on > 0.5) {
            // The band inside the edge: what the erosion took away.
            float band = own.a > 0.0 ? clamp(1.0 - alpha_of(second, p) / own.a, 0.0, 1.0) : 0.0;
            rgb = mix(rgb, vec3(params.stroke_r, params.stroke_g, params.stroke_b), band * params.stroke_opacity);
        }
        fragment_color = vec4(rgb, own.a);
        return;
    }
    float a = alpha_of(layer, p);
    vec4 result = vec4(0.0);
    if (params.a_on > 0.5) {
        float s = alpha_of(first, p - shift) * params.a_opacity;
        result = over(result, vec3(params.a_r, params.a_g, params.a_b), s);
    }
    if (params.b_on > 0.5) {
        float g = min(1.0, alpha_of(third, p) * 1.5) * params.b_opacity;
        result = over(result, vec3(params.b_r, params.b_g, params.b_b), g);
    }
    if (params.stroke_on > 0.5) {
        float s = max(alpha_of(second, p) - a, 0.0) * params.stroke_opacity;
        result = over(result, vec3(params.stroke_r, params.stroke_g, params.stroke_b), s);
    }
    fragment_color = result.a > 0.0 ? vec4(result.rgb / result.a, result.a) : vec4(0.0);
}
