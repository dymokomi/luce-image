// An edit kept only where the selection covers it: image 1 is the tile before
// the edit, image 2 after it, image 3 the selection's tile (coverage in red);
// all straight alpha. The two mix by coverage in premultiplied space, so a
// soft selection edge blends colors, not their dark fringes. Drawn with
// `replace`; the output is straight alpha.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(set = 0, binding = 1) uniform sampler2D before;
layout(set = 0, binding = 2) uniform sampler2D after;
layout(set = 0, binding = 3) uniform sampler2D selection;
void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    vec4 o = texelFetch(before, p, 0);
    vec4 n = texelFetch(after, p, 0);
    float cover = texelFetch(selection, p, 0).r;
    float a = mix(o.a, n.a, cover);
    vec3 rgb = mix(o.rgb * o.a, n.rgb * n.a, cover);
    fragment_color = vec4(a > 0.0 ? rgb / a : vec3(0.0), a);
}
