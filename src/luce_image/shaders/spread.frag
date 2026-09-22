// One separable pass over a whole-document texture (image 1), alpha only:
// mode 0 is a Gaussian of `sigma` over `radius` taps, mode 1 a maximum (a
// dilation). `horizontal` picks the axis; `width`/`height` bound the fetches.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params { float radius, sigma, horizontal, mode, width, height; } params;
layout(set = 0, binding = 1) uniform sampler2D source;
float alpha_at(ivec2 p) {
    if (p.x < 0 || p.y < 0 || p.x >= int(params.width) || p.y >= int(params.height)) return 0.0;
    return texelFetch(source, p, 0).a;
}
void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    int taps = int(params.radius);
    float result = 0.0;
    float weights = 0.0;
    for (int i = -taps; i <= taps; i++) {
        ivec2 q = params.horizontal > 0.5 ? ivec2(p.x + i, p.y) : ivec2(p.x, p.y + i);
        float a = alpha_at(q);
        if (params.mode > 0.5) {
            result = max(result, a);
        } else {
            float w = exp(-0.5 * float(i * i) / (params.sigma * params.sigma));
            result += a * w;
            weights += w;
        }
    }
    if (params.mode <= 0.5) result /= max(weights, 1e-6);
    fragment_color = vec4(0.0, 0.0, 0.0, result);
}
