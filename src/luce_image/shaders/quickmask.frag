// Quick Mask's overlay: the masked part (what the selection leaves out) tinted.
// Image 1 is a tile of the Quick Mask layer's mask at the view's level, its red
// the coverage selected (1 revealed). The overlay is `color` at `opacity` where
// the mask hides, none where it reveals, premultiplied.
#version 450
layout(location = 0) in vec4 vertex_color;
layout(location = 0) out vec4 fragment_color;
layout(push_constant) uniform Params {
    vec2 origin;      // where the tile's top-left lands on screen, in target pixels
    float zoom;       // screen pixels per texel
    float opacity;
    vec2 covered;     // the tile's covered texels
    vec2 unused;
    vec4 color;
} params;
layout(set = 0, binding = 1) uniform sampler2D mask;
void main() {
    vec2 p = (gl_FragCoord.xy - params.origin) / params.zoom;
    if (p.x < 0.0 || p.y < 0.0 || p.x >= params.covered.x || p.y >= params.covered.y) { fragment_color = vec4(0.0); return; }
    float revealed = texture(mask, p / 256.0).r;
    float alpha = (1.0 - clamp(revealed, 0.0, 1.0)) * params.opacity;
    fragment_color = vec4(params.color.rgb * alpha, alpha);
}
