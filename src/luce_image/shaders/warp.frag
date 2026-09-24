// Resample a layer through a projective map, one output tile at a time: image
// 1 is the layer flattened into one texture (straight alpha, linear light).
// An output document pixel (x, y) reads the source pixel
// ((a x + b y + c) / w, (d x + e y + f) / w) with w = g x + h y + i: an affine
// map when g = h = 0 and i = 1 (free transform), a perspective one otherwise
// (distort). `origin` is the output tile's document position and `size` the
// source texture's size; outside the source, or behind the map's horizon,
// reads as `outside` in every channel (0 for pixels, 1 for a mask: white
// reveals). `sampling` picks nearest (0), bilinear (1) or bicubic (2,
// Catmull-Rom), premultiplied while mixing so transparent neighbours do not
// darken edges.
//
// With `lifting` set, only the selected pixels move (a floating selection):
// image 2 is the selection (coverage in red) at the source's size, the moved
// pixels are the layer's weighted by it, and they land over what the
// selection leaves behind at the output pixel.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    float a, b, c, d, e, f;
    vec2 origin;
    vec2 size;
    float outside;
    float g, h, i;
    float lifting;
    float sampling;
} params;
layout(set = 0, binding = 1) uniform sampler2D source;
layout(set = 0, binding = 2) uniform sampler2D selection;

bool inside(ivec2 p) { return p.x >= 0 && p.y >= 0 && p.x < int(params.size.x) && p.y < int(params.size.y); }

// A premultiplied source texel, weighted by the selection when lifting.
vec4 tap(ivec2 p) {
    if (!inside(p)) return params.lifting > 0.5 ? vec4(0.0) : vec4(params.outside);
    vec4 s = texelFetch(source, p, 0);
    vec4 premultiplied = vec4(s.rgb * s.a, s.a);
    return params.lifting > 0.5 ? premultiplied * texelFetch(selection, p, 0).r : premultiplied;
}

// Catmull-Rom weights for the four taps around a sample `t` past the second.
vec4 cubic(float t) {
    float t2 = t * t;
    float t3 = t2 * t;
    return vec4(-0.5 * t3 + t2 - 0.5 * t, 1.5 * t3 - 2.5 * t2 + 1.0, -1.5 * t3 + 2.0 * t2 + 0.5 * t, 0.5 * t3 - 0.5 * t2);
}

// The source at `s` (texel centres at whole numbers) by the chosen filter.
vec4 sampled(vec2 s) {
    if (params.sampling < 0.5) return tap(ivec2(floor(s + 0.5)));
    vec2 i = floor(s);
    vec2 f = s - i;
    ivec2 p = ivec2(i);
    if (params.sampling < 1.5)
        return mix(mix(tap(p), tap(p + ivec2(1, 0)), f.x), mix(tap(p + ivec2(0, 1)), tap(p + ivec2(1, 1)), f.x), f.y);
    vec4 wx = cubic(f.x);
    vec4 wy = cubic(f.y);
    vec4 sum = vec4(0.0);
    for (int y = 0; y < 4; y++) {
        vec4 row = vec4(0.0);
        for (int x = 0; x < 4; x++) row += wx[x] * tap(p + ivec2(x - 1, y - 1));
        sum += wy[y] * row;
    }
    // Catmull-Rom overshoots a little at hard edges: keep it a color.
    sum.a = clamp(sum.a, 0.0, 1.0);
    sum.rgb = clamp(sum.rgb, vec3(0.0), vec3(sum.a * 65504.0));
    return sum;
}

void main() {
    vec2 o = params.origin + gl_FragCoord.xy;
    float w = params.g * o.x + params.h * o.y + params.i;
    vec4 moved = vec4(params.lifting > 0.5 ? 0.0 : params.outside);
    if (w > 1e-6) {
        moved = sampled(vec2(params.a * o.x + params.b * o.y + params.c, params.d * o.x + params.e * o.y + params.f) / w - 0.5);
    }
    if (params.lifting > 0.5) {
        // What the selection leaves behind here, under the moved pixels.
        ivec2 here = ivec2(floor(o));
        vec4 base = vec4(0.0);
        if (inside(here)) {
            vec4 s = texelFetch(source, here, 0);
            float kept = s.a * (1.0 - texelFetch(selection, here, 0).r);
            base = vec4(s.rgb * kept, kept);
        }
        moved = moved + base * (1.0 - moved.a);
    }
    fragment_color = moved.a > 0.0 ? vec4(moved.rgb / moved.a, moved.a) : vec4(0.0);
}
