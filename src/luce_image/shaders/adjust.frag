// A per-pixel adjustment of one layer tile, applied destructively: image 1 is
// the tile (straight alpha, linear light); the output replaces it. `kind`
// selects the adjustment; `p` holds its parameters, in the order each kind
// says below.
//   0 brightness/contrast: p0 brightness (-1..1), p1 contrast (-1..1)
//   1 hue/saturation/lightness: seven ranges of three — master, reds, yellows,
//     greens, cyans, blues, magentas — each hue shift in turns, saturation and
//     lightness (-1..1); p21 colorize (the master's hue and saturation become
//     the color, its lightness still lightens). Saturation scales (greys stay
//     grey); lightness moves toward white or black. Each range is whole within
//     15° of its hue and fades out by 45°, as Compositor's default bands.
//   2 invert
//   3 levels: four sets of five — RGB, red, green, blue — each input black,
//     input white, gamma, output black, output white (0..1 but gamma); each
//     channel's set applies before RGB's; a set of all zeros is left out
//   4 desaturate (luminosity)
//   5 threshold: p0 level
//   6 posterize: p0 levels
//   7 curves: image 2 is a 256×1 table; red/green/blue map each channel
//   8 exposure, in linear light: p0 stops, p1 offset, p2 gamma
//   9 black & white: p0..p5 how much reds, yellows, greens, cyans, blues and
//     magentas count toward the grey (0.4 is 40%); p6 tint hue in turns, p7
//     tint saturation, p8 tint on
//   10 color balance: shadows, midtones and highlights, each cyan-red,
//     magenta-green and yellow-blue (-1..1), each channel weighted by its own
//     value; p9 keeps the luminosity (Rec.601 luma put back)
//   11 gradient map: p0 reversed, p1..p3 the color for black, p4..p6 for
//     white (encoded), along Rec.709 luma
// The formulas follow Compositor's (Document/HueSaturation.swift,
// Rendering/AdjustPixels.c), which the same dialogs and layers share.
// Noise is not here: it is a filter, made once (filter.lucb), not an adjustment.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params { float kind; float p[23]; } params;
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
float luminosity(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }

// Lightness moved by -1..1 as Photoshop's slider does: toward black below
// zero, toward white above.
float toward(float v, float amount) { return clamp(amount < 0.0 ? v * (1.0 + amount) : v + (1.0 - v) * amount, 0.0, 1.0); }

// How much a hue (in turns) belongs to the range centred on `centre` turns:
// fully within 15°, fading out by 45°, as Photoshop's default range bars.
float in_range(float hue, float centre) {
    float d = abs(fract(hue - centre + 0.5) - 0.5) * 360.0;
    return clamp((45.0 - d) / 30.0, 0.0, 1.0);
}

// One channel through a levels set starting at p[at] (not `level`: a Metal type).
float through_levels(float v, int at) {
    float black = params.p[at], white = params.p[at + 1];
    v = clamp((v - black) / max(white - black, 1e-4), 0.0, 1.0);
    v = pow(v, 1.0 / max(params.p[at + 2], 1e-3));
    return params.p[at + 3] + v * (params.p[at + 4] - params.p[at + 3]);
}
bool levels_unset(int at) { return params.p[at + 1] == 0.0 && params.p[at + 4] == 0.0 && params.p[at + 2] == 0.0; }

// Color balance's tone weights over a channel's value, as GIMP's and Compositor's.
vec3 shadows(vec3 v) { return clamp((v - 0.333) / -0.25 + 0.5, 0.0, 1.0) * 0.7; }
vec3 midtones(vec3 v) { return clamp((v - 0.333) / 0.25 + 0.5, 0.0, 1.0) * clamp((v + 0.333 - 1.0) / -0.25 + 0.5, 0.0, 1.0) * 0.7; }
vec3 highlights(vec3 v) { return clamp((v + 0.333 - 1.0) / 0.25 + 0.5, 0.0, 1.0) * 0.7; }
float luma601(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
    vec4 o = texture(tile, gl_FragCoord.xy / 256.0);
    // Fully transparent texels carry no color worth adjusting; leaving them
    // alone keeps edges from picking up a hue where nothing is.
    if (o.a <= 0.0) {
        fragment_color = o;
        return;
    }
    int kind = int(params.kind + 0.5);
    if (kind == 8) {
        // Exposure works on light itself, not the encoded values.
        vec3 light = max(o.rgb * exp2(params.p[0]) + params.p[1], 0.0);
        light = pow(light, vec3(1.0 / max(params.p[2], 1e-3)));
        fragment_color = vec4(clamp(light, 0.0, 1.0), o.a);
        return;
    }
    // The others act on the encoded values, as Photoshop's do.
    vec3 c = to_srgb(clamp(o.rgb, 0.0, 1.0));
    if (kind == 0) {
        c = c + params.p[0];
        float k = params.p[1] < 0.0 ? 1.0 + params.p[1] : 1.0 / max(1.0 - params.p[1], 1e-3);
        c = (c - 0.5) * k + 0.5;
    } else if (kind == 1) {
        vec3 h = rgb_to_hsl(c);
        float shift = params.p[0], saturation = params.p[1], lightness = params.p[2];
        for (int range = 1; range < 7; range++) {
            float weight = in_range(h.x, float(range - 1) / 6.0);
            shift += weight * params.p[range * 3];
            saturation += weight * params.p[range * 3 + 1];
            lightness += weight * params.p[range * 3 + 2];
        }
        if (params.p[21] > 0.5) {
            h = vec3(fract(params.p[0]), clamp(params.p[1], 0.0, 1.0), toward(h.z, params.p[2]));
        } else {
            h.x = fract(h.x + shift);
            h.y = clamp(h.y * (1.0 + clamp(saturation, -1.0, 1.0)), 0.0, 1.0);
            h.z = toward(h.z, clamp(lightness, -1.0, 1.0));
        }
        c = hsl_to_rgb(h);
    } else if (kind == 2) {
        c = 1.0 - c;
    } else if (kind == 3) {
        if (!levels_unset(5)) c.r = through_levels(c.r, 5);
        if (!levels_unset(10)) c.g = through_levels(c.g, 10);
        if (!levels_unset(15)) c.b = through_levels(c.b, 15);
        if (!levels_unset(0)) c = vec3(through_levels(c.r, 0), through_levels(c.g, 0), through_levels(c.b, 0));
    } else if (kind == 4) {
        c = vec3(luminosity(c));
    } else if (kind == 5) {
        c = vec3(luminosity(c) >= params.p[0] ? 1.0 : 0.0);
    } else if (kind == 6) {
        float n = max(params.p[0], 2.0) - 1.0;
        c = floor(c * n + 0.5) / n;
    } else if (kind == 7) {
        c = vec3(texture(lut, vec2((c.r * 255.0 + 0.5) / 256.0, 0.5)).r,
                 texture(lut, vec2((c.g * 255.0 + 0.5) / 256.0, 0.5)).g,
                 texture(lut, vec2((c.b * 255.0 + 0.5) / 256.0, 0.5)).b);
    } else if (kind == 9) {
        // The grey is the darkest channel, plus what the next makes of a
        // secondary color and what the brightest makes of a primary, each
        // counted by its slider.
        float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
        float mid = c.r + c.g + c.b - mx - mn;
        float primary = mx == c.r ? params.p[0] : (mx == c.g ? params.p[2] : params.p[4]);
        float secondary = mn == c.b ? params.p[1] : (mn == c.r ? params.p[3] : params.p[5]);
        float grey = clamp(mn + (mid - mn) * secondary + (mx - mid) * primary, 0.0, 1.0);
        c = params.p[8] > 0.5 ? hsl_to_rgb(vec3(fract(params.p[6]), clamp(params.p[7], 0.0, 1.0), grey)) : vec3(grey);
    } else if (kind == 10) {
        float before = luma601(c);
        vec3 moved = c + vec3(params.p[0], params.p[1], params.p[2]) * shadows(c)
                       + vec3(params.p[3], params.p[4], params.p[5]) * midtones(c)
                       + vec3(params.p[6], params.p[7], params.p[8]) * highlights(c);
        c = clamp(moved, 0.0, 1.0);
        float after = luma601(c);
        if (params.p[9] > 0.5 && after > 1e-5) c = clamp(c * (before / after), 0.0, 1.0);
    } else if (kind == 11) {
        float t = dot(c, vec3(0.2126, 0.7152, 0.0722));
        if (params.p[0] > 0.5) t = 1.0 - t;
        c = mix(vec3(params.p[1], params.p[2], params.p[3]), vec3(params.p[4], params.p[5], params.p[6]), t);
    }
    fragment_color = vec4(to_linear(clamp(c, 0.0, 1.0)), o.a);
}
