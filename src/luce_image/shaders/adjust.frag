// A per-pixel adjustment of one layer tile, applied destructively: image 1 is
// the tile (straight alpha, linear light); the output replaces it. `kind`
// selects the adjustment; the other parameters mean what that kind says.
//   0 brightness/contrast: a = brightness (-1..1), b = contrast (-1..1)
//   1 hue/saturation/lightness: a = hue shift in turns, b = saturation (-1..1), c = lightness (-1..1)
//   2 invert
//   3 levels: a = input black, b = input white, c = gamma, d = output black, e = output white
//   4 desaturate (black and white)
//   5 threshold: a = level
//   6 posterize: a = levels
//   7 curves: image 2 is a 256×1 table; red/green/blue map each channel
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params { float kind, a, b, c, d, e; } params;
layout(set = 0, binding = 1) uniform sampler2D tile;
layout(set = 0, binding = 2) uniform sampler2D lut;

vec3 to_srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec3 to_linear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 rgb_to_hsl(vec3 c) {
    float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
    float l = (mx + mn) * 0.5, d = mx - mn;
    if (d < 1e-6) return vec3(0.0, 0.0, l);
    float s = l < 0.5 ? d / (mx + mn) : d / (2.0 - mx - mn);
    float h = mx == c.r ? (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0) : mx == c.g ? (c.b - c.r) / d + 2.0 : (c.r - c.g) / d + 4.0;
    return vec3(h / 6.0, s, l);
}
float hue_channel(float p, float q, float t) {
    t = fract(t);
    if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
    if (t < 0.5) return q;
    if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    return p;
}
vec3 hsl_to_rgb(vec3 h) {
    if (h.y < 1e-6) return vec3(h.z);
    float q = h.z < 0.5 ? h.z * (1.0 + h.y) : h.z + h.y - h.z * h.y;
    float p = 2.0 * h.z - q;
    return vec3(hue_channel(p, q, h.x + 1.0 / 3.0), hue_channel(p, q, h.x), hue_channel(p, q, h.x - 1.0 / 3.0));
}
void main() {
    vec4 o = texture(tile, gl_FragCoord.xy / 256.0);
    // Fully transparent texels carry no color worth adjusting; leaving them
    // alone keeps edges from picking up a hue where nothing is.
    if (o.a <= 0.0) {
        fragment_color = o;
        return;
    }
    // Adjustments act on the encoded values, as Photoshop's do.
    vec3 c = to_srgb(clamp(o.rgb, 0.0, 1.0));
    int kind = int(params.kind + 0.5);
    if (kind == 0) {
        c = c + params.a;
        float k = params.b < 0.0 ? 1.0 + params.b : 1.0 / max(1.0 - params.b, 1e-3);
        c = (c - 0.5) * k + 0.5;
    } else if (kind == 1) {
        vec3 h = rgb_to_hsl(c);
        h.x = fract(h.x + params.a);
        h.y = clamp(params.b < 0.0 ? h.y * (1.0 + params.b) : h.y + (1.0 - h.y) * params.b, 0.0, 1.0);
        h.z = clamp(params.c < 0.0 ? h.z * (1.0 + params.c) : h.z + (1.0 - h.z) * params.c, 0.0, 1.0);
        c = hsl_to_rgb(h);
    } else if (kind == 2) {
        c = 1.0 - c;
    } else if (kind == 3) {
        c = clamp((c - params.a) / max(params.b - params.a, 1e-4), 0.0, 1.0);
        c = pow(c, vec3(1.0 / max(params.c, 1e-3)));
        c = params.d + c * (params.e - params.d);
    } else if (kind == 4) {
        c = vec3(dot(c, vec3(0.3, 0.59, 0.11)));
    } else if (kind == 5) {
        c = vec3(dot(c, vec3(0.3, 0.59, 0.11)) >= params.a ? 1.0 : 0.0);
    } else if (kind == 6) {
        float n = max(params.a, 2.0) - 1.0;
        c = floor(c * n + 0.5) / n;
    } else if (kind == 7) {
        c = vec3(texture(lut, vec2((c.r * 255.0 + 0.5) / 256.0, 0.5)).r,
                 texture(lut, vec2((c.g * 255.0 + 0.5) / 256.0, 0.5)).g,
                 texture(lut, vec2((c.b * 255.0 + 0.5) / 256.0, 0.5)).b);
    }
    fragment_color = vec4(to_linear(clamp(c, 0.0, 1.0)), o.a);
}
