// Resample a layer through an affine map, one output tile at a time: image 1
// is the whole layer flattened into one texture (straight alpha, linear
// light). `a`..`f` map an output document pixel (x, y) to a source pixel
// (a x + b y + c, d x + e y + f); `origin` is the output tile's document
// position and `size` the source texture's size; outside the source reads as
// `outside` in every channel (0 for pixels, 1 for a mask: white reveals).
// Bilinear, premultiplied while mixing so transparent neighbours do not darken
// edges.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params { float a, b, c, d, e, f; vec2 origin; vec2 size; float outside; } params;
layout(set = 0, binding = 1) uniform sampler2D source;

vec4 tap(ivec2 p) {
    if (p.x < 0 || p.y < 0 || p.x >= int(params.size.x) || p.y >= int(params.size.y)) return vec4(params.outside);
    vec4 s = texelFetch(source, p, 0);
    return vec4(s.rgb * s.a, s.a);
}
void main() {
    vec2 o = params.origin + gl_FragCoord.xy;
    vec2 s = vec2(params.a * o.x + params.b * o.y + params.c, params.d * o.x + params.e * o.y + params.f) - 0.5;
    vec2 i = floor(s);
    vec2 f = s - i;
    ivec2 p = ivec2(i);
    vec4 c = mix(mix(tap(p), tap(p + ivec2(1, 0)), f.x), mix(tap(p + ivec2(0, 1)), tap(p + ivec2(1, 1)), f.x), f.y);
    fragment_color = c.a > 0.0 ? vec4(c.rgb / c.a, c.a) : vec4(0.0);
}
