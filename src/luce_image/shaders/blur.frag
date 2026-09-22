// One pass of a separable Gaussian blur over a tile: images 1..3 are the tile
// before, the tile itself and the tile after along `direction` (white
// placeholders never occur; absent neighbours are passed as a transparent
// tile). Straight alpha in, straight alpha out, weighted by alpha so
// transparent texels do not darken edges.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params { float radius; float sigma; float horizontal; float extent; } params;
layout(set = 0, binding = 1) uniform sampler2D before;
layout(set = 0, binding = 2) uniform sampler2D middle;
layout(set = 0, binding = 3) uniform sampler2D after;
vec4 fetch(vec2 texel) {
    // texel is in this tile's coordinates; reach into the neighbours past its edges.
    float along = params.horizontal > 0.5 ? texel.x : texel.y;
    vec2 uv;
    if (along < 0.0) {
        uv = params.horizontal > 0.5 ? vec2(texel.x + 256.0, texel.y) : vec2(texel.x, texel.y + 256.0);
        return texture(before, uv / 256.0);
    }
    if (along >= params.extent) {
        uv = params.horizontal > 0.5 ? vec2(texel.x - params.extent, texel.y) : vec2(texel.x, texel.y - params.extent);
        return texture(after, uv / 256.0);
    }
    return texture(middle, texel / 256.0);
}
void main() {
    vec2 p = gl_FragCoord.xy;
    int taps = int(params.radius);
    vec4 sum = vec4(0.0);
    float weights = 0.0;
    for (int i = -taps; i <= taps; i++) {
        float w = exp(-0.5 * float(i * i) / (params.sigma * params.sigma));
        vec2 q = params.horizontal > 0.5 ? vec2(p.x + float(i), p.y) : vec2(p.x, p.y + float(i));
        vec4 c = fetch(q);
        sum += vec4(c.rgb * c.a, c.a) * w;
        weights += w;
    }
    sum /= max(weights, 1e-6);
    fragment_color = vec4(sum.a > 0.0 ? sum.rgb / sum.a : vec3(0.0), sum.a);
}
