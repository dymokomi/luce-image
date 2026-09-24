// An adjustment layer over what is below it: image 1 is the backdrop so far,
// image 2 the backdrop adjusted, image 3 the layer's mask (red reveals; white
// when it has none), image 4 the clipping base (its alpha limits a clipped
// adjustment layer; white otherwise). They mix by the layer's opacity times
// mask and base; the backdrop's alpha stays, since an adjustment adds no
// pixels. All straight alpha; drawn with `replace`.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params { float opacity; } params;
layout(set = 0, binding = 1) uniform sampler2D backdrop;
layout(set = 0, binding = 2) uniform sampler2D adjusted;
layout(set = 0, binding = 3) uniform sampler2D mask;
layout(set = 0, binding = 4) uniform sampler2D base;
void main() {
    vec2 uv = gl_FragCoord.xy / 256.0;
    vec4 o = texture(backdrop, uv);
    vec4 n = texture(adjusted, uv);
    float k = params.opacity * texture(mask, uv).r * texture(base, uv).a;
    fragment_color = vec4(mix(o.rgb, n.rgb, k), o.a);
}
