// Filters that move pixels: each output tile samples the whole layer (image 1,
// straight alpha, linear light, the layer's extent) at
// places other than its own pixels. `place` is the tile's first pixel and the
// layer's size.
//   0 motion blur: p0 angle in radians, p1 distance in pixels: evenly spaced
//     taps along the line through each pixel, averaged by coverage; taps past
//     the canvas are left out rather than repeating its edge, which would
//     streak it
//   1 lens correction: p0 distortion (positive straightens barrel, negative
//     pincushion), p1 red-cyan and p2 blue-yellow fringe (-1..1, a percent of
//     the radius each); what falls past the frame is transparent
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params { float kind; float p[3]; vec4 place; } params;
layout(set = 0, binding = 1) uniform sampler2D layer;

// One texel premultiplied, the nearest edge texel past the edges.
vec4 texel(ivec2 p) {
    vec4 t = texelFetch(layer, clamp(p, ivec2(0), ivec2(params.place.zw) - 1), 0);
    return vec4(t.rgb * t.a, t.a);
}
// A premultiplied sample between texels at a layer pixel position: mixed
// after premultiplying, so a clear neighbour does not darken the color.
vec4 tap(vec2 at) {
    vec2 q = at - 0.5;
    vec2 f = q - floor(q);
    ivec2 b = ivec2(floor(q));
    return mix(mix(texel(b), texel(b + ivec2(1, 0)), f.x), mix(texel(b + ivec2(0, 1)), texel(b + ivec2(1, 1)), f.x), f.y);
}

void main() {
    vec2 at = params.place.xy + gl_FragCoord.xy;
    vec4 sum = vec4(0.0);
    int kind = int(params.kind + 0.5);
    if (kind == 0) {
        vec2 direction = vec2(cos(params.p[0]), -sin(params.p[0]));
        int count = int(clamp(params.p[1], 1.0, 96.0));
        float inside = 0.0;
        for (int i = 0; i < count; i++) {
            float t = (float(i) + 0.5) / float(count) - 0.5;
            vec2 point = at + direction * t * params.p[1];
            if (all(greaterThanEqual(point, vec2(0.0))) && all(lessThanEqual(point, params.place.zw))) {
                sum += tap(point);
                inside += 1.0;
            }
        }
        sum /= max(inside, 1.0);
    } else {
        vec2 centre = params.place.zw * 0.5;
        float reach = length(centre);
        vec2 d = (at - centre) / reach;
        float scale = 1.0 - params.p[0] * 0.5 * dot(d, d);
        vec2 red_at = centre + d * (scale + params.p[1] * 0.01) * reach;
        vec2 green_at = centre + d * scale * reach;
        vec2 blue_at = centre + d * (scale + params.p[2] * 0.01) * reach;
        if (any(lessThan(green_at, vec2(0.0))) || any(greaterThan(green_at, params.place.zw))) {
            fragment_color = vec4(0.0);
            return;
        }
        vec4 green = tap(green_at);
        sum = vec4(tap(red_at).r, green.g, tap(blue_at).b, green.a);
    }
    fragment_color = sum.a > 1e-6 ? vec4(clamp(sum.rgb / sum.a, 0.0, 1.0), sum.a) : vec4(0.0);
}
