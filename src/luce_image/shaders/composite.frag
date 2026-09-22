// One layer composited over the backdrop so far, in one of Photoshop's blend
// modes, at an opacity. Both inputs are straight-alpha tiles; the output is
// straight alpha too, drawn with `replace`. `source` covers the whole tile;
// `region` maps the fragment to the layer tile's texels (the backdrop tile
// always covers the fragment one to one).
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    vec4 region;      // layer texels: x, y, width, height of the tile's covered part
    float opacity;
    float mode;
} params;
layout(set = 0, binding = 1) uniform sampler2D backdrop;
layout(set = 0, binding = 2) uniform sampler2D layer;

float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
vec3 clip_color(vec3 c) {
    float l = lum(c);
    float n = min(c.r, min(c.g, c.b));
    float x = max(c.r, max(c.g, c.b));
    if (n < 0.0) c = l + (c - l) * l / max(l - n, 1e-6);
    if (x > 1.0) c = l + (c - l) * (1.0 - l) / max(x - l, 1e-6);
    return c;
}
vec3 set_lum(vec3 c, float l) { return clip_color(c + (l - lum(c))); }
float sat(vec3 c) { return max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b)); }
vec3 set_sat(vec3 c, float s) {
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    if (mx <= mn) return vec3(0.0);
    return (c - mn) * s / (mx - mn);
}
float soft(float b, float s) {
    float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
    return s <= 0.5 ? b - (1.0 - 2.0 * s) * b * (1.0 - b) : b + (2.0 * s - 1.0) * (d - b);
}
float screen(float b, float s) { return b + s - b * s; }
float burn(float b, float s) { return s <= 0.0 ? 0.0 : 1.0 - min(1.0, (1.0 - b) / s); }
float dodge(float b, float s) { return s >= 1.0 ? 1.0 : min(1.0, b / (1.0 - s)); }
float vivid(float b, float s) { return s <= 0.5 ? burn(b, 2.0 * s) : dodge(b, 2.0 * s - 1.0); }
float sep(int mode, float b, float s) {
    if (mode == 1) return min(b, s);                                  // darken
    if (mode == 2) return b * s;                                      // multiply
    if (mode == 3) return burn(b, s);                                 // color burn
    if (mode == 4) return max(b + s - 1.0, 0.0);                      // linear burn
    if (mode == 5) return max(b, s);                                  // lighten
    if (mode == 6) return screen(b, s);                               // screen
    if (mode == 7) return dodge(b, s);                                // color dodge
    if (mode == 8) return min(b + s, 1.0);                            // linear dodge
    if (mode == 9) return b <= 0.5 ? s * 2.0 * b : screen(s, 2.0 * b - 1.0);          // overlay
    if (mode == 10) return soft(b, s);                                // soft light
    if (mode == 11) return s <= 0.5 ? b * 2.0 * s : screen(b, 2.0 * s - 1.0);         // hard light
    if (mode == 12) return vivid(b, s);                               // vivid light
    if (mode == 13) return clamp(b + 2.0 * s - 1.0, 0.0, 1.0);        // linear light
    if (mode == 14) return s <= 0.5 ? min(b, 2.0 * s) : max(b, 2.0 * s - 1.0);        // pin light
    if (mode == 15) return vivid(b, s) < 0.5 ? 0.0 : 1.0;             // hard mix
    if (mode == 16) return abs(b - s);                                // difference
    if (mode == 17) return b + s - 2.0 * b * s;                       // exclusion
    if (mode == 18) return max(b - s, 0.0);                           // subtract
    if (mode == 19) return s <= 0.0 ? 1.0 : min(b / s, 1.0);          // divide
    return s;                                                         // normal
}
vec3 blend(int mode, vec3 b, vec3 s) {
    if (mode == 20) return set_lum(set_sat(s, sat(b)), lum(b));       // hue
    if (mode == 21) return set_lum(set_sat(b, sat(s)), lum(b));       // saturation
    if (mode == 22) return set_lum(s, lum(b));                        // color
    if (mode == 23) return set_lum(b, lum(s));                        // luminosity
    if (mode == 24) return lum(s) < lum(b) ? s : b;                   // darker color
    if (mode == 25) return lum(s) > lum(b) ? s : b;                   // lighter color
    return vec3(sep(mode, b.r, s.r), sep(mode, b.g, s.g), sep(mode, b.b, s.b));
}
void main() {
    vec2 p = gl_FragCoord.xy;
    vec4 bd = texture(backdrop, p / 256.0);
    vec2 layer_uv = (params.region.xy + p) / 256.0;
    vec4 src = texture(layer, layer_uv);
    if (p.x >= params.region.z || p.y >= params.region.w) src = vec4(0.0);
    float sa = src.a * params.opacity;
    int mode = int(params.mode + 0.5);
    vec3 mixed = blend(mode, bd.rgb, src.rgb);
    // W3C compositing: the blend applies where both are present, the plain
    // source where only the source is.
    vec3 cs = (1.0 - bd.a) * src.rgb + bd.a * mixed;
    float a = sa + bd.a * (1.0 - sa);
    vec3 rgb = a > 0.0 ? (cs * sa + bd.rgb * bd.a * (1.0 - sa)) / a : vec3(0.0);
    fragment_color = vec4(rgb, a);
}
